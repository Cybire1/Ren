import { failure, kovaUpload } from '@/lib/api'

/** A photo from the dashboard (already resized in the browser), stored as the shop. */
export async function POST(request: Request) {
  const type = request.headers.get('content-type') ?? 'application/octet-stream'
  try {
    return Response.json(await kovaUpload(await request.arrayBuffer(), type), { status: 201 })
  } catch (error) {
    return failure(error)
  }
}
