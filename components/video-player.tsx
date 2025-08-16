"use client"

import { useRef, useEffect, useState } from "react"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  RotateCcw,
  Repeat,
  Minimize,
  Volume1,
  FastForward,
  Rewind,
} from "lucide-react"

interface VideoPlayerProps {
  src: string
  title: string
  onError?: () => void
  onNext?: () => void
  onPrevious?: () => void
  embedSrc?: string
}

export function VideoPlayer({ src, title, onError, onNext, onPrevious, embedSrc }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
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

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    setIsPiPSupported("pictureInPictureEnabled" in document)

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setIsLoading(false)
      console.log("[v0] Video loaded successfully")
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
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
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("error", handleError)
    video.addEventListener("loadstart", handleLoadStart)
    video.addEventListener("canplay", handleCanPlay)
    document.addEventListener("fullscreenchange", handleFullscreenChange)

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("error", handleError)
      video.removeEventListener("loadstart", handleLoadStart)
      video.removeEventListener("canplay", handleCanPlay)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [onError, src, embedSrc])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    setCurrentTime(0)
    setIsPlaying(false)
    setIsLoading(true)
    setUseIframe(false)
    video.load()
  }, [src])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const video = videoRef.current
      if (!video) return

      switch (e.code) {
        case "Space":
          e.preventDefault()
          togglePlayPause()
          break
        case "ArrowLeft":
          e.preventDefault()
          skipBackward()
          break
        case "ArrowRight":
          e.preventDefault()
          skipForward()
          break
        case "ArrowUp":
          e.preventDefault()
          setVolume((prev) => Math.min(1, prev + 0.1))
          break
        case "ArrowDown":
          e.preventDefault()
          setVolume((prev) => Math.max(0, prev - 0.1))
          break
        case "KeyF":
          e.preventDefault()
          toggleFullscreen()
          break
        case "KeyM":
          e.preventDefault()
          toggleMute()
          break
        case "KeyL":
          e.preventDefault()
          toggleLoop()
          break
        case "KeyP":
          e.preventDefault()
          if (isPiPSupported) togglePictureInPicture()
          break
      }
    }

    document.addEventListener("keydown", handleKeyPress)
    return () => document.removeEventListener("keydown", handleKeyPress)
  }, [isPiPSupported])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.volume = isMuted ? 0 : volume
  }, [volume, isMuted])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.playbackRate = playbackRate
  }, [playbackRate])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.loop = isLoop
  }, [isLoop])

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

  if (useIframe && (src.includes("drive.google.com") || embedSrc)) {
    const iframeSrc =
      embedSrc ||
      (src.includes("drive.google.com")
        ? src.replace(/\/uc\?export=download&id=/, "/file/d/").replace(/&.*$/, "/preview")
        : src)

    return (
      <div className="relative bg-black rounded-lg overflow-hidden">
        <iframe
          src={iframeSrc}
          className="w-full aspect-video"
          allow="autoplay; encrypted-media"
          allowFullScreen
          title={title}
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {onPrevious && (
                <button
                  onClick={handlePrevious}
                  className="text-white hover:text-blue-400 p-2 rounded transition-colors bg-transparent border-none cursor-pointer"
                  type="button"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={togglePlayPause}
                className="text-white hover:text-blue-400 p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors border-none cursor-pointer"
                type="button"
              >
                <Play className="h-5 w-5" />
              </button>
              {onNext && (
                <button
                  onClick={handleNext}
                  className="text-white hover:text-blue-400 p-2 rounded transition-colors bg-transparent border-none cursor-pointer"
                  type="button"
                >
                  <SkipForward className="h-5 w-5" />
                </button>
              )}
            </div>
            <span className="text-white text-sm truncate max-w-xs" title={title}>
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
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}

      <div
        className="absolute inset-0 cursor-pointer z-0"
        onClick={togglePlayPause}
        style={{ bottom: "120px" }} // Don't overlap with controls
      />

      <div className="absolute bottom-0 left-0 right-0 bg-black/90 p-4 z-20 pointer-events-auto">
        <div className="mb-4">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={handleSeek}
            className="w-full cursor-pointer"
          />
          <div className="flex justify-between text-xs text-white/80 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onPrevious && (
              <button
                onClick={handlePrevious}
                className="text-white hover:text-blue-400 p-2 rounded transition-colors bg-transparent border-none cursor-pointer"
                type="button"
              >
                <SkipBack className="h-5 w-5" />
              </button>
            )}

            <button
              onClick={skipBackward}
              className="text-white hover:text-blue-400 p-2 rounded transition-colors bg-transparent border-none cursor-pointer"
              type="button"
            >
              <Rewind className="h-4 w-4" />
            </button>

            <button
              onClick={togglePlayPause}
              className="text-white hover:text-blue-400 p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors border-none cursor-pointer"
              type="button"
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </button>

            <button
              onClick={skipForward}
              className="text-white hover:text-blue-400 p-2 rounded transition-colors bg-transparent border-none cursor-pointer"
              type="button"
            >
              <FastForward className="h-4 w-4" />
            </button>

            {onNext && (
              <button
                onClick={handleNext}
                className="text-white hover:text-blue-400 p-2 rounded transition-colors bg-transparent border-none cursor-pointer"
                type="button"
              >
                <SkipForward className="h-5 w-5" />
              </button>
            )}

            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={toggleMute}
                className="text-white hover:text-blue-400 p-2 rounded transition-colors bg-transparent border-none cursor-pointer"
                type="button"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : volume > 0.5 ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <Volume1 className="h-4 w-4" />
                )}
              </button>
              <div className="w-20">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="w-full cursor-pointer"
                />
              </div>
              <span className="text-white/60 text-xs w-8">{Math.round((isMuted ? 0 : volume) * 100)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={playbackRate.toString()} onValueChange={handlePlaybackRateChange}>
              <SelectTrigger className="w-16 h-8 text-white border-white/20 bg-black/50 hover:bg-black/70 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.25">0.25x</SelectItem>
                <SelectItem value="0.5">0.5x</SelectItem>
                <SelectItem value="0.75">0.75x</SelectItem>
                <SelectItem value="1">1x</SelectItem>
                <SelectItem value="1.25">1.25x</SelectItem>
                <SelectItem value="1.5">1.5x</SelectItem>
                <SelectItem value="2">2x</SelectItem>
              </SelectContent>
            </Select>

            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-blue-400 p-2 rounded transition-colors bg-transparent border-none cursor-pointer"
              type="button"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs mt-2">
          <div className="flex items-center gap-4">
            <button
              onClick={restart}
              className="text-white/60 hover:text-white p-1 rounded transition-colors bg-transparent border-none cursor-pointer flex items-center gap-1"
              type="button"
            >
              <RotateCcw className="h-3 w-3" />
              Restart
            </button>

            <button
              onClick={toggleLoop}
              className={`text-white/60 hover:text-white p-1 rounded transition-colors bg-transparent border-none cursor-pointer flex items-center gap-1 ${isLoop ? "text-blue-400" : ""}`}
              type="button"
            >
              <Repeat className="h-3 w-3" />
              Loop
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-white/60 truncate max-w-xs" title={title}>
              {title}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
