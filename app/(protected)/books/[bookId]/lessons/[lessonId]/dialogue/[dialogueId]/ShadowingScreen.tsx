'use client'

import { useRef, useState } from 'react'
import { Mic, Pause, Play, Square } from 'lucide-react'
import type { Dialogue } from '@/lib/db/types'
import { gradeSyllables, type GradeResult } from '@/lib/shadowing/pinyinGrading'
import { useSpeechRecognition } from '@/lib/shadowing/useSpeechRecognition'

export default function ShadowingScreen({ dialogue }: { dialogue: Dialogue }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [result, setResult] = useState<GradeResult | null>(null)
  const [permissionError, setPermissionError] = useState(false)
  const [isAutoPause, setIsAutoPause] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex
  const isAutoPauseRef = useRef(isAutoPause)
  isAutoPauseRef.current = isAutoPause

  const currentLine = dialogue.lines[currentIndex]

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const transcriptRef = useRef<string>('')
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null)
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null)

  // Grading must wait for SpeechRecognition to genuinely finish, not for
  // MediaRecorder.onstop (which fires the instant the user clicks "stop").
  // `onresult` is asynchronous and often arrives after that click in real
  // browsers, so grading here - triggered by `onend`, which the Web Speech
  // API spec guarantees always fires after `onresult`/`onerror` - is what
  // guarantees we grade the final, settled transcript instead of a stale
  // or empty one.
  //
  // Grading only ever applies to a single, unambiguous line: when
  // continuous playback ("Tự động dừng" OFF) is active, there is no
  // reliable way to know which line the user was practicing when they
  // hit record, so grading is skipped entirely rather than guessed at.
  const speech = useSpeechRecognition(
    (transcript) => {
      transcriptRef.current = transcript
    },
    () => {
      if (!isAutoPauseRef.current) return
      setResult(gradeSyllables(currentLine.text_zh, transcriptRef.current))
    }
  )

  function playSample() {
    if (!currentLine.audio_url) return
    sampleAudioRef.current?.pause()
    const audio = new Audio(currentLine.audio_url)
    sampleAudioRef.current = audio
    setIsPlaying(true)

    audio.onended = () => {
      if (isAutoPauseRef.current) {
        setIsPlaying(false)
        return
      }
      const nextIndex = currentIndexRef.current + 1
      if (nextIndex < dialogue.lines.length) {
        setCurrentIndex(nextIndex)
        setResult(null)
        setRecordedUrl(null)
        const nextLine = dialogue.lines[nextIndex]
        if (nextLine.audio_url) {
          const nextAudio = new Audio(nextLine.audio_url)
          sampleAudioRef.current = nextAudio
          nextAudio.onended = audio.onended
          nextAudio.play()
        } else {
          setIsPlaying(false)
        }
      } else {
        setIsPlaying(false)
      }
    }

    audio.play()
  }

  function pauseSample() {
    sampleAudioRef.current?.pause()
    setIsPlaying(false)
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setPermissionError(false)
      setResult(null)
      transcriptRef.current = ''
      chunksRef.current = []

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setRecordedUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((track) => track.stop())
      }

      // Start together: SpeechRecognition needs a live microphone stream,
      // so it must start alongside the recorder, not after it stops (the
      // prior implementation attempt started recognition post-stop and it
      // silently produced no transcript).
      recorder.start()
      speech.start()
      setIsRecording(true)
    } catch {
      setPermissionError(true)
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    speech.stop()
    setIsRecording(false)
  }

  function playRecorded() {
    if (!recordedUrl) return
    const audio = new Audio(recordedUrl)
    recordedAudioRef.current = audio
    audio.play()
  }

  function selectLine(index: number) {
    sampleAudioRef.current?.pause()
    setIsPlaying(false)
    setCurrentIndex(index)
    setResult(null)
    setRecordedUrl(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {permissionError && (
        <div className="rounded-card-sm border border-error-border bg-error-bg p-4 text-center text-sm font-medium text-error-text">
          Không thể truy cập Micro. Vui lòng cấp quyền sử dụng Micro trong cài đặt trình duyệt.
        </div>
      )}

      <div className="flex items-center justify-between rounded-card-sm border border-card-border bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={isPlaying ? pauseSample : playSample}
          disabled={!currentLine.audio_url}
          className={`flex items-center justify-center gap-2 rounded-btn px-4 py-2 text-sm font-bold transition-all ${
            currentLine.audio_url
              ? 'bg-brand-red text-white hover:bg-brand-red-dark'
              : 'cursor-not-allowed bg-card-border text-ink-faint'
          }`}
        >
          {isPlaying ? <Pause className="h-4 w-4" strokeWidth={2.5} /> : <Play className="h-4 w-4" strokeWidth={2.5} />}
          {isPlaying ? 'Tạm dừng' : 'Nghe mẫu'}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-faint">Tự động dừng</span>
          <button
            type="button"
            role="switch"
            aria-checked={isAutoPause}
            aria-label="Tự động dừng"
            onClick={() => setIsAutoPause((prev) => !prev)}
            className={`relative inline-flex h-6 w-11 items-center rounded-pill transition-colors ${
              isAutoPause ? 'bg-brand-red' : 'bg-card-border'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isAutoPause ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="rounded-card border border-card-border bg-white p-6 text-center shadow-sm">
        {currentLine.speaker_zh && (
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">{currentLine.speaker_zh}</p>
        )}
        <h2 className="font-han-title text-3xl font-bold text-ink">{currentLine.text_zh}</h2>
        {currentLine.pinyin && <p className="mt-3 text-xl font-medium tracking-wide text-brand-gold">{currentLine.pinyin}</p>}
        {currentLine.translation_vi && <p className="mt-3 text-ink-muted">{currentLine.translation_vi}</p>}
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={playRecorded}
          disabled={!recordedUrl}
          className={`flex items-center justify-center gap-2 rounded-btn border-2 px-6 py-3 text-sm font-bold tracking-wide transition-all ${
            recordedUrl
              ? 'border-brand-gold text-brand-gold hover:bg-brand-gold/5'
              : 'cursor-not-allowed border-card-border text-ink-faint'
          }`}
        >
          <Play className="h-4 w-4" strokeWidth={2.5} />
          Phát lại ghi âm
        </button>

        {isRecording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="flex animate-pulse items-center justify-center gap-2 rounded-btn bg-brand-red px-8 py-3 text-sm font-bold tracking-wide text-white transition-all hover:bg-brand-red-dark"
          >
            <Square className="h-4 w-4" strokeWidth={2.5} />
            Dừng ghi âm
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={!speech.isSupported}
            className="flex items-center justify-center gap-2 rounded-btn bg-brand-gold px-8 py-3 text-sm font-bold tracking-wide text-white transition-all hover:-translate-y-0.5"
          >
            <Mic className="h-4 w-4" strokeWidth={2.5} />
            Ghi âm
          </button>
        )}
      </div>

      {!speech.isSupported && (
        <p className="text-center text-sm text-ink-faint">
          Trình duyệt không hỗ trợ nhận diện giọng nói. Vui lòng dùng Chrome hoặc Edge.
        </p>
      )}

      {!isAutoPause && (
        <p className="text-center text-sm text-ink-faint">
          Bật &quot;Tự động dừng&quot; để được chấm điểm phát âm theo từng câu.
        </p>
      )}

      {isAutoPause && result && (
        <div
          className={`flex flex-col gap-3 rounded-card-sm border p-5 ${
            result.status === 'correct'
              ? 'border-success-border bg-success-bg'
              : result.status === 'almost'
                ? 'border-brand-gold/40 bg-accent-bg'
                : 'border-error-border bg-error-bg'
          }`}
        >
          <p
            className={`font-bold ${
              result.status === 'correct'
                ? 'text-success-text'
                : result.status === 'almost'
                  ? 'text-ink-gold-text'
                  : 'text-error-text'
            }`}
          >
            {result.status === 'correct' && 'Phát âm chính xác!'}
            {result.status === 'almost' && 'Gần đúng rồi, cố lên!'}
            {result.status === 'incorrect' && 'Chưa chính xác, thử lại nhé!'}
          </p>
          <div className="flex flex-col gap-1 text-sm">
            <p>
              <span className="font-bold text-ink-faint">Mẫu: </span>
              {result.targetSyllablesToned.join(' ')}
            </p>
            <p>
              <span className="font-bold text-ink-faint">Bạn đọc: </span>
              {result.transcriptSyllablesToned.join(' ') || '(không nghe rõ)'}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {dialogue.lines.map((line, index) => {
          if (index === currentIndex) return null
          return (
            <button
              key={line.id}
              type="button"
              onClick={() => selectLine(index)}
              className="rounded-card-sm border border-card-border bg-white/60 px-5 py-4 text-left opacity-70 shadow-sm transition-all hover:opacity-100"
            >
              <span className="font-han-title text-lg font-bold text-ink">{line.text_zh}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
