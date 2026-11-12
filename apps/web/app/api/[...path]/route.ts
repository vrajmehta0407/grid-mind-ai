import { NextRequest, NextResponse } from "next/server";

const FASTAPI_BASE = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const joined = path.join("/");
  const isRootResource = joined === "tariffs" || joined.startsWith("tariffs/") || joined === "health" || joined === "agent-runs";
  const targetPath = isRootResource ? `/${joined}` : `/api/${joined}`;
  const targetUrl = `${FASTAPI_BASE}${targetPath}${request.nextUrl.search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const userId = request.headers.get("x-user-id");
  if (userId) headers.set("x-user-id", userId);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(targetUrl, init);
    const outHeaders = new Headers();
    const upType = upstream.headers.get("content-type");
    if (upType) outHeaders.set("content-type", upType);
    const disp = upstream.headers.get("content-disposition");
    if (disp) outHeaders.set("content-disposition", disp);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: outHeaders,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "FastAPI backend unreachable", detail: String(err) },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;

