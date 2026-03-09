export const runtime = 'nodejs'

import OpenAI from 'openai'

function getOpenClawClient() {
  const token = process.env.OPENCLAW_GATEWAY_TOKEN
  if (!token) return null
  return new OpenAI({
    baseURL: 'http://localhost:18789/v1',
    apiKey: token,
  })
}

export async function POST(request: Request) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Expected multipart form data' }, { status: 400 })
  }

  const audioFile = formData.get('audio')
  if (!audioFile || !(audioFile instanceof File)) {
    return Response.json({ error: 'Missing audio file' }, { status: 400 })
  }

  try {
    const openai = getOpenClawClient()
    if (!openai) {
      return Response.json({ error: 'Missing OPENCLAW_GATEWAY_TOKEN env var.' }, { status: 500 })
    }

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
    })

    return Response.json({ text: transcription.text })
  } catch (err) {
    console.error('Transcription error:', err)
    return Response.json(
      { error: 'Transcription failed. Check OpenClaw gateway.' },
      { status: 500 }
    )
  }
}
