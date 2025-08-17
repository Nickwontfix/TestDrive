"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { SkipBack, SkipForward, Clock, Eye } from "lucide-react"

interface VideoPlayerProps {
  src: string
  title: string
  onError?: () => void
  onNext?: () => void
  onPrevious?: () => void
  embedSrc?: string
  onProgress?: (currentTime: number, duration: number) => void
}

export function VideoPlayer({ src, title, onError, onNext, onPrevious, embedSrc, onProgress }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [useIframe, setUseIframe] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [quality, setQuality] = useState("auto")
  const [isLoop, setIsLoop] = useState(false)
  const [isPiPSupported, setIsPiPSupported] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showAdvancedControls, setShowAdvancedControls] = useState(false)
  const [autoplay, setAutoplay] = useState(false)
  const [subtitle, setSubtitle] = useState("off")
  const [isCompleted, setIsCompleted] = useState(false)

  const [autoProgress, setAutoProgress] = useState(0)
  const [autoCurrentTime, setAutoCurrentTime] = useState(0)
  const [estimatedDuration, setEstimatedDuration] = useState(0)
  const [trackingStartTime, setTrackingStartTime] = useState<number | null>(null)
  const [isVisible, setIsVisible] = useState(true)

  const estimateVideoDuration = (videoTitle: string): number => {
    // Look for duration patterns in title
    const hourMinPattern = /(\d+)h\s*(\d+)m/i
    const minPattern = /(\d+)min/i
    const timePattern = /(\d+):(\d+):(\d+)/
    const shortTimePattern = /(\d+):(\d+)/

    let match = videoTitle.match(hourMinPattern)
    if (match) {
      return Number.parseInt(match[1]) * 3600 + Number.parseInt(match[2]) * 60
    }

    match = videoTitle.match(minPattern)
    if (match) {
      return Number.parseInt(match[1]) * 60
    }

    match = videoTitle.match(timePattern)
    if (match) {
      return Number.parseInt(match[1]) * 3600 + Number.parseInt(match[2]) * 60 + Number.parseInt(match[3])
    }

    match = videoTitle.match(shortTimePattern)
    if (match) {
      return Number.parseInt(match[1]) * 60 + Number.parseInt(match[2])
    }

    const lowerTitle = videoTitle.toLowerCase()
    const numberMatch = videoTitle.match(/^(\d+)\./)
    const videoNumber = numberMatch ? Number.parseInt(numberMatch[1]) : 0

    // Realistic duration estimates
    if (lowerTitle.includes("intro") || lowerTitle.includes("welcome") || lowerTitle.includes("orientation")) {
      return 600 // 10 minutes for intro videos
    } else if (lowerTitle.includes("fundamentals") || lowerTitle.includes("basics")) {
      return 1200 // 20 minutes
    } else if (lowerTitle.includes("advanced") || lowerTitle.includes("deep")) {
      return 2400 // 40 minutes
    } else if (lowerTitle.includes("tutorial") || lowerTitle.includes("lesson")) {
      return 1800 // 30 minutes
    } else {
      // Default based on sequence
      if (videoNumber <= 5)
        return 900 // 15 minutes
      else if (videoNumber <= 20)
        return 1500 // 25 minutes
      else return 1800 // 30 minutes
    }
  }

  const iframeSrc =
    embedSrc ||
    (src.includes("drive.google.com")
      ? // Using embed URL format to bypass virus scan warning
        src.replace("/view", "/preview").replace("?usp=sharing", "") + "?embedded=true&autoplay=0"
      : src)

  useEffect(() => {
    if (useIframe) {
      const duration = estimateVideoDuration(title)
      setEstimatedDuration(duration)
      setTrackingStartTime(Date.now())
      setAutoProgress(0)
      setAutoCurrentTime(0)
      console.log(
        "[v0] Starting automatic tracking for:",
        title,
        "estimated duration:",
        Math.round(duration / 60),
        "minutes",
      )
    }
  }, [useIframe, title])

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden
      setIsVisible(visible)

      if (useIframe && trackingStartTime) {
        if (!visible) {
          // Pause tracking - save current progress
          const elapsed = (Date.now() - trackingStartTime) / 1000
          setAutoCurrentTime((prev) => prev + elapsed)
          setTrackingStartTime(null)
          console.log("[v0] Paused tracking - tab hidden")
        } else if (visible && !trackingStartTime) {
          // Resume tracking
          setTrackingStartTime(Date.now())
          console.log("[v0] Resumed tracking - tab visible")
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [useIframe, trackingStartTime])

  const updateProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (duration > 0 && onProgress) {
        onProgress(currentTime, duration)
      }
    },
    [onProgress],
  )

  useEffect(() => {
    if (!useIframe || !estimatedDuration) return

    const interval = setInterval(() => {
      if (!document.hidden && !isPlaying) {
        setAutoProgress((prev) => {
          const newProgress = prev + 1
          updateProgress(newProgress, estimatedDuration)

          if (newProgress >= estimatedDuration * 0.9) {
            setIsCompleted(true)
          }

          return newProgress
        })
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [useIframe, estimatedDuration, isPlaying, updateProgress])

  const handleTimeUpdate = () => {
    if (videoRef.current && !useIframe) {
      const currentTime = videoRef.current.currentTime
      const duration = videoRef.current.duration

      if (duration > 0) {
        updateProgress(currentTime, duration)

        if (currentTime >= duration * 0.9) {
          setIsCompleted(true)
        }
      }
    }
  }

  const [driveProgress, setDriveProgress] = useState(0)
  const [driveCurrentTime, setDriveCurrentTime] = useState(0)
  const [driveDuration, setDriveDuration] = useState(0)
  const [isTrackingDrive, setIsTrackingDrive] = useState(false)
  const [videoId, setVideoId] = useState<string | null>(null)

  const extractVideoId = (url: string): string | null => {
    const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /id=([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  const createEnhancedIframeSrc = (originalSrc: string): string => {
    const id = extractVideoId(originalSrc)
    if (!id) return originalSrc

    return `https://drive.google.com/file/d/${id}/preview?embedded=true&autoplay=0&controls=1`
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    setIsPiPSupported("pictureInPictureEnabled" in document)

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setIsLoading(false)
      console.log("[v0] Video loaded successfully")
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    const handleError = () => {
      console.log("[v0] Video error occurred, trying iframe fallback")
      setIsLoading(false)
      if (src.includes("drive.google.com") || embedSrc) {
        setUseIframe(true)
      } else {
        onError?.()
      }
    }

    const handleLoadStart = () => setIsLoading(true)
    const handleCanPlay = () => setIsLoading(false)

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    video.addEventListener("loadedmetadata", handleLoadedMetadata)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("error", handleError)
    video.addEventListener("loadstart", handleLoadStart)
    video.addEventListener("canplay", handleCanPlay)
    document.addEventListener("fullscreenchange", handleFullscreenChange)

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("error", handleError)
      video.removeEventListener("loadstart", handleLoadStart)
      video.removeEventListener("canplay", handleCanPlay)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [onError, src, embedSrc, onProgress])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    setCurrentTime(0)
    setIsPlaying(false)
    setIsLoading(true)
    setUseIframe(false)
    setAutoProgress(0)
    setAutoCurrentTime(0)
    setTrackingStartTime(null)
    video.load()
  }, [src])

  const togglePlayPause = () => {
    const video = videoRef.current
    if (!video) return

    console.log("[v0] Play/Pause button clicked, current state:", video.paused ? "paused" : "playing")

    if (video.paused) {
      video.play()
      console.log("[v0] Video playing")
    } else {
      video.pause()
      console.log("[v0] Video paused")
    }
  }

  const skipForward = () => {
    const video = videoRef.current
    if (!video) return

    console.log("[v0] Skip forward button clicked")
    video.currentTime = Math.min(video.duration, video.currentTime + 10)
  }

  const skipBackward = () => {
    const video = videoRef.current
    if (!video) return

    console.log("[v0] Skip backward button clicked")
    video.currentTime = Math.max(0, video.currentTime - 10)
  }

  const handleSeek = (value: number[]) => {
    const video = videoRef.current
    if (!video) return

    console.log("[v0] Seek bar clicked, seeking to:", value[0])
    video.currentTime = value[0]
    setCurrentTime(value[0])
  }

  const handleVolumeChange = (value: number[]) => {
    console.log("[v0] Volume changed to:", value[0])
    setVolume(value[0])
    setIsMuted(false)
  }

  const toggleMute = () => {
    console.log("[v0] Mute button clicked, current state:", isMuted ? "muted" : "unmuted")
    setIsMuted(!isMuted)
  }

  const toggleFullscreen = () => {
    const video = videoRef.current
    if (!video) return

    console.log("[v0] Fullscreen button clicked")

    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      video.requestFullscreen()
    }
  }

  const handlePrevious = () => {
    console.log("[v0] Previous button clicked")
    if (onPrevious) {
      onPrevious()
    } else {
      console.log("[v0] No onPrevious callback provided")
    }
  }

  const handleNext = () => {
    console.log("[v0] Next button clicked")
    if (onNext) {
      onNext()
    } else {
      console.log("[v0] No onNext callback provided")
    }
  }

  const handlePlaybackRateChange = (rate: string) => {
    const rateValue = Number.parseFloat(rate)
    setPlaybackRate(rateValue)
    console.log("[v0] Playback rate changed to:", rateValue)
  }

  const handleQualityChange = (newQuality: string) => {
    setQuality(newQuality)
    console.log("[v0] Quality changed to:", newQuality)
    // Note: Actual quality change would require multiple video sources
  }

  const toggleLoop = () => {
    setIsLoop(!isLoop)
    console.log("[v0] Loop toggled:", !isLoop)
  }

  const togglePictureInPicture = async () => {
    const video = videoRef.current
    if (!video || !isPiPSupported) return

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await video.requestPictureInPicture()
      }
    } catch (error) {
      console.log("[v0] Picture-in-Picture error:", error)
    }
  }

  const restart = () => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = 0
    video.play()
  }

  const handleDownload = () => {
    const link = document.createElement("a")
    link.href = src
    link.download = title
    link.click()
    console.log("[v0] Download initiated")
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          url: window.location.href,
        })
      } catch (error) {
        console.log("[v0] Share cancelled")
      }
    } else {
      navigator.clipboard.writeText(window.location.href)
      console.log("[v0] Link copied to clipboard")
    }
  }

  const handleBookmark = () => {
    console.log("[v0] Video bookmarked at", formatTime(currentTime))
    // Add bookmark functionality here
  }

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const seconds = Math.floor(time % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const markAsWatched = () => {
    if (onProgress) {
      console.log("[v0] Manually marking video as watched")
      onProgress(3600, 3600) // Simulate full duration watched
    }
  }

  const markProgress = (percentage: number) => {
    if (onProgress) {
      const simulatedDuration = 3600 // 1 hour default
      const currentTime = (percentage / 100) * simulatedDuration
      console.log("[v0] Manually setting progress to", percentage + "%")
      onProgress(currentTime, simulatedDuration)
    }
  }

  if (useIframe && (src.includes("drive.google.com") || embedSrc)) {
    return (
      <div className="relative bg-black rounded-lg overflow-hidden">
        <iframe
          ref={iframeRef}
          src={createEnhancedIframeSrc(src)} // Using enhanced iframe source to bypass virus scan
          className="w-full aspect-video"
          allow="autoplay; encrypted-media"
          allowFullScreen
          title={title}
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {onPrevious && (
                <button
                  onClick={onPrevious}
                  className="text-white hover:text-blue-400 p-2 rounded transition-colors bg-black/30 hover:bg-black/50 border-none cursor-pointer"
                  type="button"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
              )}
              {onNext && (
                <button
                  onClick={onNext}
                  className="text-white hover:text-blue-400 p-2 rounded transition-colors bg-black/30 hover:bg-black/50 border-none cursor-pointer"
                  type="button"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-white text-xs">
              <Eye className="h-3 w-3" />
              <span>Progress: {Math.round(autoProgress)}%</span>
              <Clock className="h-3 w-3" />
              <span>
                {formatTime(autoCurrentTime + (trackingStartTime ? (Date.now() - trackingStartTime) / 1000 : 0))}
              </span>
              <span>/ {formatTime(estimatedDuration)}</span>
            </div>
            <span className="text-white text-sm truncate max-w-xs bg-black/50 px-2 py-1 rounded" title={title}>
              {title}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative bg-black rounded-lg overflow-hidden group">
      <video
        ref={videoRef}
        src={src}
        className="w-full aspect-video"
        crossOrigin="anonymous"
        preload="metadata"
        playsInline
        autoPlay={autoplay}
        onTimeUpdate={handleTimeUpdate}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}

      <div
        className="absolute inset-0 cursor-pointer z-0"
        onClick={() => {
          const video = videoRef.current
          if (!video) return
          if (video.paused) {
            video.play()
          } else {
            video.pause()
          }
        }}
      />

      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <div className="flex items-center gap-2">
          {onPrevious && (
            <button
              onClick={onPrevious}
              className="text-white hover:text-blue-400 p-2 rounded transition-colors bg-black/50 hover:bg-black/70 border-none cursor-pointer"
              type="button"
            >
              <SkipBack className="h-4 w-4" />
            </button>
          )}
          {onNext && (
            <button
              onClick={onNext}
              className="text-white hover:text-blue-400 p-2 rounded transition-colors bg-black/50 hover:bg-black/70 border-none cursor-pointer"
              type="button"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          )}
        </div>
        <span className="text-white text-sm bg-black/50 px-2 py-1 rounded max-w-xs truncate" title={title}>
          {title}
        </span>
      </div>
    </div>
  )
}
