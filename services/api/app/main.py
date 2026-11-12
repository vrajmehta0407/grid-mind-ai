from __future__ import annotations

import asyncio
import csv
import io
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from app.ai.adapter import ai_adapter
from app.core.config import settings
from app.core.logging import agent_logger
from app.core.pii import mask_consumer_number
from app.db.store import DEMO_USER_ID, new_id, store
from app.export.pdf_report import render_energy_report_pdf
from app.extraction.extractor import extract_bill
from app.forecast.forecaster import generate_forecast
from app.insights.agents import (
    analyze_bill,
    build_savings_plan,
    run_chat_assistant,
    simulate_whatif,
)
from app.orchestrator.orchestrator import build_dashboard_bundle
from app.tariff.engine import (
    calculate_bill,
    calculate_delta,
    get_tariff_registry,
    verify_bill_total,
)
from app.waste.detector import detect_waste

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB per PRD FR-2

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _uid(x_user_id: str | None) -> str:
    return x_user_id or DEMO_USER_ID


class CalculateRequest(BaseModel):
    tariff_id: str
    units_kwh: float = Field(ge=0)
    sanctioned_kw: float | None = None


class VerifyRequest(BaseModel):
    tariff_id: str
    units_kwh: float = Field(ge=0)
    extracted_total: float = Field(ge=0)
    sanctioned_kw: float | None = None


class DeltaRequest(BaseModel):
    tariff_id: str
    baseline_units_kwh: float = Field(ge=0)
    delta_units_kwh: float
    sanctioned_kw: float | None = None


class SaveBillRequest(BaseModel):
    provider: str
    consumer_no_masked: str | None = None
    period_start: str
    period_end: str
    due_date: str | None = None
    units: float = Field(ge=0)
    total: float | None = None
    avg_temp_c: float | None = None
    temp_upload_id: str | None = None
    extraction_confidence: dict[str, float] = Field(default_factory=dict)


class WhatIfRequest(BaseModel):
    baseline_units_kwh: float | None = None
    ac_hours_delta: float = 0.0
    ac_setpoint_c: int = Field(default=22, ge=16, le=30)
    add_new_ac_star: int | None = None
    bldc_fans_count: int = Field(default=0, ge=0, le=20)
    solar_kw: float = Field(default=0.0, ge=0.0, le=20.0)


class ProfileUpdateRequest(BaseModel):
    display_name: str | None = None
    city: str | None = None
    provider: str | None = None
    tariff_category: str | None = None
    household_size: int | None = Field(default=None, ge=1, le=20)
    sanctioned_kw: float | None = Field(default=None, ge=0.5, le=50.0)
    keep_bill_files: bool | None = None
    has_solar: bool | None = None
    onboarded: bool | None = None


class ApplianceCreateRequest(BaseModel):
    type: str
    label: str
    count: int = Field(default=1, ge=1, le=50)
    watts: int = Field(ge=1, le=25000)
    hours_per_day: float = Field(ge=0, le=24)
    star_rating: int | None = Field(default=None, ge=1, le=5)
    is_always_on: bool = False


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "ai": ai_adapter.active_provider_info(),
    }


@app.get("/tariffs")
def list_tariffs() -> dict[str, object]:
    tariffs = get_tariff_registry().list_tariffs()
    return {
        "sample_notice": "sample, verify before use",
        "tariffs": [t.model_dump() for t in tariffs],
    }


@app.post("/tariffs/calculate")
def api_calculate_tariff(req: CalculateRequest) -> dict[str, object]:
    try:
        return calculate_bill(req.tariff_id, req.units_kwh, req.sanctioned_kw).model_dump()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/tariffs/verify")
def api_verify_bill(req: VerifyRequest) -> dict[str, object]:
    try:
        return verify_bill_total(
            extracted_total=req.extracted_total,
            tariff_id=req.tariff_id,
            units_kwh=req.units_kwh,
            sanctioned_kw=req.sanctioned_kw,
        ).model_dump()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/tariffs/delta")
def api_delta(req: DeltaRequest) -> dict[str, float]:
    try:
        return calculate_delta(
            tariff_id=req.tariff_id,
            baseline_units_kwh=req.baseline_units_kwh,
            delta_units_kwh=req.delta_units_kwh,
            sanctioned_kw=req.sanctioned_kw,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/dashboard")
async def api_dashboard(x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    uid = _uid(x_user_id)
    user = store.get_user(uid)
    bundle = await build_dashboard_bundle(
        user=user,
        bills=store.bills.get(uid, []),
        appliances=store.appliances.get(uid, []),
        readings=store.readings.get(uid, []),
        existing_actions=store.actions.get(uid, []),
    )
    store.findings[uid] = bundle["findings"]
    done = [a for a in store.actions.get(uid, []) if a.get("status") == "done"]
    store.actions[uid] = bundle["savings_plan"]["active_actions"] + done
    return bundle


async def _process_extraction_job(
    job_id: str,
    uid: str,
    file_bytes: bytes,
    filename: str,
    content_type: str,
) -> None:
    job = store.jobs[job_id]
    job["status"] = "running"
    job["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        user = store.get_user(uid)

        async def _extract_coro():
            return extract_bill(
                file_bytes,
                filename,
                content_type,
                user.get("provider", "gujarat_dgvcl_domestic_v1"),
                float(user.get("sanctioned_kw", 2.0)),
                uid,
            )

        extracted = await asyncio.wait_for(
            _extract_coro(),
            timeout=settings.extraction_timeout_s,
        )
        temp_id = new_id("tmp")
        if user.get("keep_bill_files"):
            store.temp_uploads[temp_id] = {"filename": filename, "size": len(file_bytes), "kept": True}
        result_dict = extracted.model_dump()
        result_dict["temp_upload_id"] = temp_id
        job["status"] = "completed"
        job["result"] = result_dict
    except Exception as exc:
        job["status"] = "failed"
        job["error"] = str(exc)
    finally:
        job["updated_at"] = datetime.now(timezone.utc).isoformat()


@app.post("/api/bills/upload")
async def api_upload_bill(
    file: UploadFile = File(...),
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    uid = _uid(x_user_id)
    store.get_user(uid)
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB limit")

    allowed = {"application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"}
    ct = file.content_type or "application/octet-stream"
    if ct not in allowed and not (file.filename or "").lower().endswith((".pdf", ".png", ".jpg", ".jpeg", ".txt")):
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload PDF, JPG, or PNG.")

    job_id = new_id("job")
    store.jobs[job_id] = {
        "id": job_id,
        "user_id": uid,
        "kind": "bill_extraction",
        "status": "queued",
        "payload": {"filename": file.filename},
        "result": None,
        "error": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    asyncio.create_task(
        _process_extraction_job(job_id, uid, content, file.filename or "bill.pdf", ct)
    )
    return {"job_id": job_id, "status": "queued"}


@app.get("/api/jobs/{job_id}")
def api_get_job(job_id: str, x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    job = store.jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if x_user_id and job.get("user_id") != x_user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return job


@app.get("/api/jobs/{job_id}/stream")
async def api_stream_job(job_id: str) -> StreamingResponse:
    if job_id not in store.jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_gen():
        for _ in range(80):
            job = store.jobs.get(job_id)
            if not job:
                break
            yield f"data: {json.dumps(job)}\n\n"
            if job["status"] in ("completed", "failed"):
                break
            await asyncio.sleep(0.25)

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@app.post("/api/bills")
async def api_save_bill(
    req: SaveBillRequest,
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    uid = _uid(x_user_id)
    user = store.get_user(uid)
    sanctioned_kw = float(user.get("sanctioned_kw", 2.0))
    calc = calculate_bill(req.provider, req.units, sanctioned_kw)

    if req.temp_upload_id and not user.get("keep_bill_files"):
        store.temp_uploads.pop(req.temp_upload_id, None)

    ver = (
        verify_bill_total(req.total, calc.tariff_id, req.units, sanctioned_kw).model_dump()
        if req.total is not None
        else {"needs_review": False, "mismatch_pct": 0.0}
    )

    bill_record = {
        "id": new_id("bill"),
        "user_id": uid,
        "provider": calc.tariff_id,
        "provider_name": calc.provider,
        "consumer_no_masked": mask_consumer_number(req.consumer_no_masked) or "******0000",
        "period_start": req.period_start,
        "period_end": req.period_end,
        "due_date": req.due_date,
        "units": calc.units_kwh,
        "energy_charge": calc.energy_charge,
        "fixed_charge": calc.fixed_charge,
        "fppca_charge": calc.fppca_charge,
        "duty_charge": calc.duty_charge,
        "other_charge": calc.other_charge,
        "total": round(req.total, 2) if req.total is not None else calc.total,
        "computed_total": calc.total,
        "avg_temp_c": req.avg_temp_c,
        "effective_rate": calc.effective_rate_per_kwh,
        "next_unit_marginal_cost": calc.next_unit_marginal_cost_rs,
        "current_slab_label": calc.current_slab_label,
        "slab_breakdown": [s.model_dump() for s in calc.slab_breakdown],
        "sample_notice": calc.sample_notice,
        "extraction_confidence": req.extraction_confidence,
        "needs_review": bool(ver.get("needs_review", False)),
        "status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    store.bills.setdefault(uid, []).append(bill_record)
    return {"bill": bill_record, "verification": ver}


@app.get("/api/bills")
def api_list_bills(x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    uid = _uid(x_user_id)
    store.get_user(uid)
    bills = sorted(store.bills.get(uid, []), key=lambda b: b["period_end"], reverse=True)
    return {"bills": bills}


@app.get("/api/bills/{bill_id}")
def api_get_bill(bill_id: str, x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    uid = _uid(x_user_id)
    bills = sorted(store.bills.get(uid, []), key=lambda b: b["period_end"])
    idx = next((i for i, b in enumerate(bills) if b["id"] == bill_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    current = bills[idx]
    prev = bills[idx - 1] if idx > 0 else None
    yoy = bills[idx - 12] if idx >= 12 else None
    analysis = analyze_bill(current, prev, yoy, user_id=uid)
    return {"bill": current, "previous_bill": prev, "analysis": analysis}


@app.get("/api/analysis/{bill_id}")
def api_analysis(bill_id: str, x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    uid = _uid(x_user_id)
    bills = sorted(store.bills.get(uid, []), key=lambda b: b["period_end"])
    idx = next((i for i, b in enumerate(bills) if b["id"] == bill_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    current = bills[idx]
    prev = bills[idx - 1] if idx > 0 else None
    yoy = bills[idx - 12] if idx >= 12 else None
    return analyze_bill(current, prev, yoy, user_id=uid)


@app.post("/api/readings/import")
async def api_import_readings(
    file: UploadFile = File(...),
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    uid = _uid(x_user_id)
    store.get_user(uid)
    raw = (await file.read()).decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(raw))
    imported: list[dict[str, Any]] = []
    for row in reader:
        ts = row.get("ts") or row.get("timestamp") or row.get("date")
        kwh_raw = row.get("kwh") or row.get("units")
        if not ts or not kwh_raw:
            continue
        try:
            kwh_val = float(kwh_raw)
        except ValueError:
            continue
        rec = {
            "id": new_id("rd"),
            "user_id": uid,
            "ts": ts,
            "kwh": kwh_val,
            "night_min_watts": float(row["night_min_watts"]) if row.get("night_min_watts") else None,
            "source": "csv",
        }
        imported.append(rec)
    store.readings.setdefault(uid, []).extend(imported)
    return {"imported_count": len(imported)}


@app.get("/api/forecast")
def api_forecast(
    months: int = Query(default=3, ge=1, le=3),
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    uid = _uid(x_user_id)
    user = store.get_user(uid)
    return generate_forecast(
        user=user,
        bills=store.bills.get(uid, []),
        appliances=store.appliances.get(uid, []),
        months=months,
    )


@app.post("/api/whatif")
def api_whatif(
    req: WhatIfRequest,
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    uid = _uid(x_user_id)
    user = store.get_user(uid)
    bills = sorted(store.bills.get(uid, []), key=lambda b: b["period_end"])
    base_units = req.baseline_units_kwh
    if base_units is None:
        base_units = float(bills[-1]["units"]) if bills else 240.0

    return simulate_whatif(
        tariff_id=user.get("provider", "gujarat_dgvcl_domestic_v1"),
        baseline_units_kwh=base_units,
        sanctioned_kw=float(user.get("sanctioned_kw", 2.0)),
        ac_hours_delta=req.ac_hours_delta,
        ac_setpoint_c=req.ac_setpoint_c,
        add_new_ac_star=req.add_new_ac_star,
        bldc_fans_count=req.bldc_fans_count,
        solar_kw=req.solar_kw,
        user_id=uid,
    )


@app.get("/api/findings")
def api_findings(x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    uid = _uid(x_user_id)
    user = store.get_user(uid)
    bills = store.bills.get(uid, [])
    appliances = store.appliances.get(uid, [])
    readings = store.readings.get(uid, [])
    findings = detect_waste(user, bills, appliances, readings)
    store.findings[uid] = findings
    plan = build_savings_plan(uid, findings, store.actions.get(uid, []), bills)
    return {"findings": findings, "savings_plan": plan}


@app.post("/api/actions/{action_id}/complete")
def api_complete_action(
    action_id: str,
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    uid = _uid(x_user_id)
    actions = store.actions.get(uid, [])
    target = next((a for a in actions if a["id"] == action_id), None)
    if not target:
        findings = detect_waste(
            store.get_user(uid),
            store.bills.get(uid, []),
            store.appliances.get(uid, []),
            store.readings.get(uid, []),
        )
        plan = build_savings_plan(uid, findings, actions, store.bills.get(uid, []))
        actions = plan["active_actions"] + plan["completed_actions"]
        store.actions[uid] = actions
        target = next((a for a in actions if a["id"] == action_id), None)

    if not target:
        raise HTTPException(status_code=404, detail="Action not found")

    target["status"] = "done"
    target["done_at"] = datetime.now(timezone.utc).isoformat()
    target["rs_saved_verified"] = target["rs_saved_est"]

    plan = build_savings_plan(
        uid,
        store.findings.get(uid, []),
        store.actions.get(uid, []),
        store.bills.get(uid, []),
    )
    done = [a for a in store.actions.get(uid, []) if a.get("status") == "done"]
    store.actions[uid] = plan["active_actions"] + done
    return {"action": target, "savings_plan": plan}


@app.get("/api/profile")
def api_get_profile(x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    uid = _uid(x_user_id)
    return {
        "user": store.get_user(uid),
        "appliances": store.appliances.get(uid, []),
    }


@app.put("/api/profile")
def api_update_profile(
    req: ProfileUpdateRequest,
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    uid = _uid(x_user_id)
    user = store.get_user(uid)
    for k, v in req.model_dump(exclude_none=True).items():
        user[k] = v
    return {"user": user}


@app.get("/api/appliances")
def api_list_appliances(x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    uid = _uid(x_user_id)
    return {"appliances": store.appliances.get(uid, [])}


@app.post("/api/appliances")
def api_add_appliance(
    req: ApplianceCreateRequest,
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    uid = _uid(x_user_id)
    store.get_user(uid)
    item = {"id": new_id("app"), "user_id": uid, **req.model_dump()}
    store.appliances.setdefault(uid, []).append(item)
    return {"appliance": item}


@app.delete("/api/appliances/{appliance_id}")
def api_delete_appliance(
    appliance_id: str,
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    uid = _uid(x_user_id)
    apps = store.appliances.get(uid, [])
    store.appliances[uid] = [a for a in apps if a["id"] != appliance_id]
    return {"deleted": appliance_id}


@app.post("/api/chat")
def api_chat(
    req: ChatRequest,
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    uid = _uid(x_user_id)
    user = store.get_user(uid)
    return run_chat_assistant(
        query=req.message,
        user=user,
        bills=store.bills.get(uid, []),
        appliances=store.appliances.get(uid, []),
        findings=store.findings.get(uid, []),
        readings=store.readings.get(uid, []),
    )


@app.get("/api/export/data")
def api_export_data(x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    uid = _uid(x_user_id)
    return store.export_user_data(uid)


@app.get("/api/export/pdf")
async def api_export_pdf(x_user_id: str | None = Header(default=None)) -> Response:
    uid = _uid(x_user_id)
    bundle = await build_dashboard_bundle(
        user=store.get_user(uid),
        bills=store.bills.get(uid, []),
        appliances=store.appliances.get(uid, []),
        readings=store.readings.get(uid, []),
        existing_actions=store.actions.get(uid, []),
    )
    pdf_bytes = render_energy_report_pdf(bundle)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="gridmind-energy-report.pdf"'},
    )


@app.delete("/api/account")
def api_delete_account(x_user_id: str | None = Header(default=None)) -> dict[str, str]:
    uid = _uid(x_user_id)
    store.delete_user_data(uid)
    return {"status": "deleted", "user_id": uid}


@app.get("/agent-runs")
def get_agent_runs() -> dict[str, object]:
    return {"runs": agent_logger.recent()}
