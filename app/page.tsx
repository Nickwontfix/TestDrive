"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Play,
  Folder,
  Video,
  Search,
  LayoutGrid,
  List,
  SortAsc,
  SortDesc,
  Filter,
  Heart,
  Clock,
  Download,
  Share2,
  Plus,
  MoreVertical,
  Trash2,
  PlayCircle,
  LogIn,
  LogOut,
  User,
  FolderOpen,
  Archive,
  AlertCircle,
  Shield,
} from "lucide-react"
import { VideoPlayer } from "@/components/video-player"
import JSZip from "jszip"

interface GoogleUser {
  id: string
  name: string
  email: string
  picture: string
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  webContentLink: string
  thumbnailLink?: string
  size?: string
  modifiedTime?: string
  parents?: string[]
}

interface DriveFolder {
  id: string
  name: string
  webViewLink: string
}

interface WatchHistoryItem {
  file: DriveFile
  watchedAt: number
  progress?: number
}

interface Playlist {
  id: string
  name: string
  files: DriveFile[]
  createdAt: number
}

type SortOption = "name" | "size" | "type" | "modified"
type SortDirection = "asc" | "desc"
type ViewMode = "grid" | "list"

const getDownloadUrl = (file: DriveFile) => {
  if (file.id) {
    return `https://drive.google.com/uc?export=download&id=${file.id}`
  }

  if (file.webContentLink) {
    const url = new URL(file.webContentLink)
    const id = url.searchParams.get("id")
    if (id) {
      return `https://drive.google.com/uc?export=download&id=${id}`
    }
  }

  return file.webViewLink
}

export default function GoogleDriveVideoPlayer() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [accessToken, setAccessToken] = useState("")
  const [sharedFolders, setSharedFolders] = useState<DriveFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState("")

  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedVideo, setSelectedVideo] = useState<DriveFile | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [filterType, setFilterType] = useState<string>("all")
  const [activeTab, setActiveTab] = useState("all")

  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [newPlaylistName, setNewPlaylistName] = useState("")
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(false)

  useEffect(() => {
    const initializeGoogleAuth = () => {
      console.log("[v0] Initializing Google Identity Services")

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      console.log("[v0] Client ID check:", clientId ? "Present" : "Missing", clientId?.substring(0, 20) + "...")

      if (!clientId || clientId === "YOUR_GOOGLE_CLIENT_ID") {
        console.log("[v0] Client ID validation failed")
        setIsAuthenticated(false)
        setUser(null)
        setAccessToken("")
        setError(
          "Google Client ID not configured. Please add NEXT_PUBLIC_GOOGLE_CLIENT_ID to your environment variables in Project Settings.",
        )
        setIsAuthReady(false)
        return
      }

      console.log("[v0] Checking Google APIs availability:", !!window.google?.accounts?.oauth2)

      if (typeof window !== "undefined" && window.google?.accounts?.oauth2) {
        console.log("[v0] Initializing token client")
        try {
          console.log(
            "[v0] Creating token client with scopes: https://www.googleapis.com/auth/drive.readonly profile email",
          )

          // Initialize the token client for OAuth2
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: "https://www.googleapis.com/auth/drive.readonly profile email",
            callback: (response: any) => {
              console.log("[v0] Token callback triggered:", response)
              if (response.error) {
                console.error("[v0] Token request failed:", response.error)
                setError(`Authentication failed: ${response.error}`)
                return
              }

              console.log("[v0] Token received successfully")
              setAccessToken(response.access_token)

              // Get user profile information
              fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${response.access_token}`)
                .then((res) => res.json())
                .then((userInfo) => {
                  console.log("[v0] User info received:", userInfo)
                  setUser({
                    name: userInfo.name,
                    email: userInfo.email,
                    picture: userInfo.picture,
                  })
                  setIsAuthenticated(true)
                  setError("")

                  console.log("[v0] Auth success processed, discovering folders")
                  discoverSharedFolders(response.access_token)
                })
                .catch((error) => {
                  console.error("[v0] Failed to get user info:", error)
                  setError("Failed to get user information")
                })
            },
            error_callback: (error: any) => {
              console.error("[v0] Token client error:", error)
              setError(`Authentication error: ${error.message || error}`)
            },
          })

          console.log("[v0] Token client created:", !!tokenClient)

          // Store token client for later use
          ;(window as any).tokenClient = tokenClient
          setIsAuthReady(true)
          console.log("[v0] Google Identity Services initialized successfully")
        } catch (error: any) {
          console.error("[v0] GIS initialization failed:", error)
          setError(`Failed to initialize Google authentication: ${error.message}`)
          setIsAuthReady(false)
        }
      } else {
        console.log("[v0] Google APIs not available yet, window.google:", !!window.google)
        setError("Google Identity Services not loaded properly")
      }
    }

    if (!window.google?.accounts?.oauth2) {
      console.log("[v0] Loading Google Identity Services script")
      const script = document.createElement("script")
      script.src = "https://accounts.google.com/gsi/client"
      script.async = true
      script.defer = true

      script.onload = () => {
        console.log("[v0] Google Identity Services script loaded")
        // Wait a bit for the library to fully initialize
        setTimeout(initializeGoogleAuth, 100)
      }

      script.onerror = (error) => {
        console.error("[v0] Failed to load Google Identity Services script:", error)
        setError("Failed to load Google authentication. Please check your internet connection and try again.")
        setIsAuthReady(false)
      }

      document.head.appendChild(script)
    } else {
      initializeGoogleAuth()
    }
  }, [])

  useEffect(() => {
    const savedFavorites = localStorage.getItem("drive-streamer-favorites")
    const savedHistory = localStorage.getItem("drive-streamer-history")
    const savedPlaylists = localStorage.getItem("drive-streamer-playlists")

    if (savedFavorites) {
      try {
        setFavorites(new Set(JSON.parse(savedFavorites)))
      } catch (error) {
        console.error("[v0] Error parsing saved favorites:", error)
        localStorage.removeItem("drive-streamer-favorites")
      }
    }
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory)
        // Validate that each item has the correct structure
        const validHistory = parsedHistory.filter(
          (item: any) => item && item.file && item.file.id && typeof item.watchedAt === "number",
        )
        setWatchHistory(validHistory)
      } catch (error) {
        console.error("[v0] Error parsing saved history:", error)
        localStorage.removeItem("drive-streamer-history")
      }
    }
    if (savedPlaylists) {
      try {
        setPlaylists(JSON.parse(savedPlaylists))
      } catch (error) {
        console.error("[v0] Error parsing saved playlists:", error)
        localStorage.removeItem("drive-streamer-playlists")
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("drive-streamer-favorites", JSON.stringify([...favorites]))
  }, [favorites])

  useEffect(() => {
    localStorage.setItem("drive-streamer-history", JSON.stringify(watchHistory))
  }, [watchHistory])

  useEffect(() => {
    localStorage.setItem("drive-streamer-playlists", JSON.stringify(playlists))
  }, [playlists])

  const signInWithGoogle = () => {
    try {
      console.log("[v0] Attempting Google sign in")
      if (!isAuthReady) {
        throw new Error("Google authentication is still loading. Please wait a moment and try again.")
      }

      const tokenClient = (window as any).tokenClient
      if (!tokenClient) {
        throw new Error("Google authentication not properly initialized")
      }

      // Request access token (requires user gesture)
      tokenClient.requestAccessToken()
    } catch (error: any) {
      console.error("[v0] Sign in error:", error)
      setError(`Sign in error: ${error.message}`)
    }
  }

  const signOut = () => {
    try {
      console.log("[v0] Signing out")

      if (accessToken && window.google?.accounts?.oauth2) {
        // Revoke the access token
        window.google.accounts.oauth2.revoke(accessToken, () => {
          console.log("[v0] Token revoked successfully")
        })
      }

      // Clear application state
      setIsAuthenticated(false)
      setUser(null)
      setAccessToken("")
      setFiles([])
      setSharedFolders([])
      setSelectedFolderId("")
      setSelectedVideo(null)
      setError("") // Clear errors on sign out
      setIsAuthReady(false)
    } catch (error: any) {
      console.error("[v0] Sign out error:", error)
      setError(`Sign out error: ${error.message}`)
    }
  }

  const discoverSharedFolders = async (token: string) => {
    setLoading(true)
    try {
      console.log("[v0] Discovering shared folders")
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and sharedWithMe=true&fields=files(id,name,webViewLink)&access_token=${token}`,
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] Folder discovery failed:", response.status, errorText)
        throw new Error(`Failed to fetch shared folders: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log("[v0] Found folders:", data.files?.length || 0)
      setSharedFolders(data.files || [])

      if (data.files && data.files.length === 1) {
        console.log("[v0] Auto-selecting single folder")
        setSelectedFolderId(data.files[0].id)
        fetchVideosFromFolder(data.files[0].id, token)
      }
    } catch (err: any) {
      console.error("[v0] Error discovering folders:", err)
      setError(err instanceof Error ? err.message : "Failed to discover folders")
    } finally {
      setLoading(false)
    }
  }

  const fetchVideosRecursively = async (
    folderId: string,
    authToken: string,
    allVideos: DriveFile[] = [],
  ): Promise<DriveFile[]> => {
    try {
      console.log("[v0] Searching folder:", folderId)

      // Get all files and folders in current directory
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType,webViewLink,webContentLink,thumbnailLink,size,modifiedTime,parents)&access_token=${authToken}`,
      )

      if (!response.ok) {
        console.error("[v0] Failed to fetch from folder:", folderId, response.status)
        return allVideos
      }

      const data = await response.json()
      const files = data.files || []

      // Separate videos and folders
      const videoFiles: DriveFile[] = []
      const subFolders: DriveFile[] = []

      files.forEach((file: DriveFile) => {
        if (file.mimeType === "application/vnd.google-apps.folder") {
          subFolders.push(file)
        } else {
          // Check if it's a video file
          const isVideo =
            file.mimeType.startsWith("video/") ||
            [".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"].some((ext) => file.name.toLowerCase().endsWith(ext))

          if (isVideo) {
            videoFiles.push(file)
          }
        }
      })

      console.log("[v0] Found in", folderId, ":", videoFiles.length, "videos,", subFolders.length, "subfolders")

      // Add current level videos to collection
      allVideos.push(...videoFiles)

      // Recursively search subfolders
      for (const folder of subFolders) {
        await fetchVideosRecursively(folder.id, authToken, allVideos)
      }

      return allVideos
    } catch (err) {
      console.error("[v0] Error searching folder:", folderId, err)
      return allVideos
    }
  }

  const fetchVideosFromFolder = async (folderId: string, token?: string) => {
    const authToken = token || accessToken
    if (!authToken || !folderId) {
      console.error("[v0] Missing auth token or folder ID")
      return
    }

    setLoading(true)
    setError("")

    try {
      console.log("[v0] Starting recursive search from folder:", folderId)

      const allVideoFiles = await fetchVideosRecursively(folderId, authToken)

      console.log("[v0] Total video files found across all folders:", allVideoFiles.length)
      setFiles(allVideoFiles)

      if (allVideoFiles.length === 0) {
        setError("No video files found in this folder or its subfolders")
      }
    } catch (err: any) {
      console.error("[v0] Error fetching videos:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const extractAndPlayZip = async (file: DriveFile) => {
    try {
      console.log("[v0] Extracting zip file:", file.name)
      setLoading(true)
      setError("")

      const response = await fetch(file.webContentLink || "", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        console.error("[v0] Zip download failed:", response.status)
        throw new Error(`Failed to download zip file: ${response.status} ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      console.log("[v0] Downloaded zip, size:", arrayBuffer.byteLength)

      const zip = new JSZip()
      const zipContent = await zip.loadAsync(arrayBuffer)

      const videoFiles: DriveFile[] = []
      const videoExtensions = [".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"]

      for (const [filename, zipEntry] of Object.entries(zipContent.files)) {
        if (!zipEntry.dir && videoExtensions.some((ext) => filename.toLowerCase().endsWith(ext))) {
          console.log("[v0] Found video in zip:", filename)
          const blob = await zipEntry.async("blob")
          const url = URL.createObjectURL(blob)

          videoFiles.push({
            id: `zip_${file.id}_${filename}`,
            name: filename,
            mimeType: `video/${filename.split(".").pop()?.toLowerCase()}`,
            webViewLink: url,
            webContentLink: url,
            size: blob.size.toString(),
            modifiedTime: new Date().toISOString(),
            parents: [file.id],
          })
        }
      }

      console.log("[v0] Extracted videos:", videoFiles.length)
      if (videoFiles.length > 0) {
        setFiles((prev) => [...prev, ...videoFiles])
        selectVideo(videoFiles[0])
      } else {
        setError("No video files found in the zip archive")
      }
    } catch (err: any) {
      console.error("[v0] Zip extraction error:", err)
      setError(err instanceof Error ? err.message : "Failed to extract zip file")
    } finally {
      setLoading(false)
    }
  }

  const filteredAndSortedFiles = useMemo(() => {
    let sourceFiles = files

    switch (activeTab) {
      case "favorites":
        sourceFiles = files.filter((file) => favorites.has(file.id))
        break
      case "recent":
        const recentIds = watchHistory.slice(0, 20).map((item) => item.file.id)
        sourceFiles = files.filter((file) => recentIds.includes(file.id))
        break
      case "all":
      default:
        sourceFiles = files
        break
    }

    const filtered = sourceFiles.filter((file) => {
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = filterType === "all" || file.mimeType.includes(filterType)
      return matchesSearch && matchesType
    })

    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name)
          break
        case "size":
          const sizeA = Number.parseInt(a.size || "0")
          const sizeB = Number.parseInt(b.size || "0")
          comparison = sizeA - sizeB
          break
        case "type":
          comparison = a.mimeType.localeCompare(b.mimeType)
          break
        case "modified":
          const dateA = new Date(a.modifiedTime || 0).getTime()
          const dateB = new Date(b.modifiedTime || 0).getTime()
          comparison = dateA - dateB
          break
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    return filtered
  }, [files, searchQuery, sortBy, sortDirection, filterType, activeTab, favorites, watchHistory])

  const videoTypes = useMemo(() => {
    const types = new Set(files.map((file) => file.mimeType.split("/")[1]?.toLowerCase()).filter(Boolean))
    return Array.from(types)
  }, [files])

  const toggleFavorite = (file: DriveFile) => {
    console.log("[v0] Toggling favorite for:", file.name)
    const newFavorites = new Set(favorites)
    if (newFavorites.has(file.id)) {
      newFavorites.delete(file.id)
    } else {
      newFavorites.add(file.id)
    }
    setFavorites(newFavorites)
  }

  const addToWatchHistory = (file: DriveFile) => {
    const newHistory = watchHistory.filter((item) => item.file.id !== file.id)
    newHistory.unshift({
      file: file,
      watchedAt: Date.now(),
      progress: 0,
    })
    setWatchHistory(newHistory.slice(0, 50))
  }

  const addToPlaylist = (file: DriveFile, playlistId: string) => {
    console.log("[v0] Adding to playlist:", file.name, "->", playlistId)
    setPlaylists(
      playlists.map((playlist) => {
        if (playlist.id === playlistId) {
          const fileExists = playlist.files.some((f) => f.id === file.id)
          if (!fileExists) {
            setError(`Added "${file.name}" to playlist "${playlist.name}"`)
            setTimeout(() => setError(""), 2000)
            return { ...playlist, files: [...playlist.files, file] }
          } else {
            setError(`"${file.name}" is already in playlist "${playlist.name}"`)
            setTimeout(() => setError(""), 2000)
          }
        }
        return playlist
      }),
    )
  }

  const removeFromPlaylist = (fileId: string, playlistId: string) => {
    setPlaylists(
      playlists.map((playlist) => {
        if (playlist.id === playlistId) {
          return { ...playlist, files: playlist.files.filter((f) => f.id !== fileId) }
        }
        return playlist
      }),
    )
  }

  const deletePlaylist = (playlistId: string) => {
    setPlaylists(playlists.filter((p) => p.id !== playlistId))
  }

  const selectVideo = (file: DriveFile) => {
    // Validate that this is actually a video file
    if (file.mimeType === "application/vnd.google-apps.folder") {
      console.error("[v0] Cannot play folder as video:", file.name)
      setError("Cannot play folders. Please select a video file.")
      return
    }

    if (
      !file.mimeType.startsWith("video/") &&
      ![".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"].some((ext) => file.name.toLowerCase().endsWith(ext))
    ) {
      console.error("[v0] Selected file is not a video:", file.name, file.mimeType)
      setError("Selected file is not a video. Please choose a video file.")
      return
    }

    console.log("[v0] Selecting video:", file.name, file.mimeType)
    setSelectedVideo(file)
    setError("")

    // Add to watch history
    const newHistory = watchHistory.filter((item) => item.file.id !== file.id)
    newHistory.unshift({
      file: file,
      watchedAt: Date.now(),
      progress: 0,
    })
    setWatchHistory(newHistory.slice(0, 50))
  }

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return "Unknown size"
    const size = Number.parseInt(bytes)
    const units = ["B", "KB", "MB", "GB"]
    let unitIndex = 0
    let fileSize = size

    while (fileSize >= 1024 && unitIndex < units.length - 1) {
      fileSize /= 1024
      unitIndex++
    }

    return `${fileSize.toFixed(1)} ${units[unitIndex]}`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown date"
    return new Date(dateString).toLocaleDateString()
  }

  const getStreamUrl = (file: DriveFile) => {
    if (file.id) {
      return `https://drive.google.com/uc?export=download&id=${file.id}`
    }

    if (file.webContentLink) {
      // Extract file ID from webContentLink if available
      const url = new URL(file.webContentLink)
      const id = url.searchParams.get("id")
      if (id) {
        return `https://drive.google.com/uc?export=download&id=${id}`
      }
    }

    // Fallback to view link
    return file.webViewLink
  }

  const getEmbedUrl = (file: DriveFile) => {
    if (file.id) {
      return `https://drive.google.com/file/d/${file.id}/preview`
    }

    if (file.webContentLink) {
      const url = new URL(file.webContentLink)
      const id = url.searchParams.get("id")
      if (id) {
        return `https://drive.google.com/file/d/${id}/preview`
      }
    }

    return file.webViewLink
  }

  const shareVideo = (file: DriveFile) => {
    console.log("[v0] Sharing video:", file.name)
    try {
      if (navigator.share) {
        navigator.share({
          title: file.name,
          url: file.webViewLink,
        })
      } else {
        navigator.clipboard.writeText(file.webViewLink)
        // Show a temporary notification that link was copied
        setError("Link copied to clipboard!")
        setTimeout(() => setError(""), 2000)
      }
    } catch (error) {
      console.error("[v0] Share error:", error)
      setError("Failed to share video")
    }
  }

  const toggleSortDirection = () => {
    console.log("[v0] Toggling sort direction from:", sortDirection)
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
  }

  const handleFolderSelect = (folderId: string) => {
    setSelectedFolderId(folderId)
    fetchVideosFromFolder(folderId, accessToken)
  }

  const createPlaylist = () => {
    if (newPlaylistName.trim()) {
      setPlaylists([
        ...playlists,
        {
          id: Date.now().toString(),
          name: newPlaylistName.trim(),
          files: [],
          createdAt: Date.now(),
        },
      ])
      setNewPlaylistName("")
      setShowCreatePlaylist(false)
    }
  }

  const handleNext = () => {
    const currentIndex = filteredAndSortedFiles.findIndex((f) => f.id === selectedVideo?.id)
    const nextIndex = (currentIndex + 1) % filteredAndSortedFiles.length
    selectVideo(filteredAndSortedFiles[nextIndex])
  }

  const handlePrevious = () => {
    const currentIndex = filteredAndSortedFiles.findIndex((f) => f.id === selectedVideo?.id)
    const prevIndex = currentIndex === 0 ? filteredAndSortedFiles.length - 1 : currentIndex - 1
    selectVideo(filteredAndSortedFiles[prevIndex])
  }

  const VideoCard = ({
    file,
    showPlaylistOptions = false,
    playlistId,
  }: { file: DriveFile; showPlaylistOptions?: boolean; playlistId?: string }) => (
    <Card
      key={file.id}
      className={`cursor-pointer transition-colors hover:bg-accent ${
        selectedVideo?.id === file.id ? "ring-2 ring-primary" : ""
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0" onClick={() => selectVideo(file)}>
            {file.mimeType === "application/zip" || file.name.toLowerCase().endsWith(".zip") ? (
              <Archive className="h-8 w-8 text-primary" />
            ) : (
              <Video className="h-8 w-8 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0" onClick={() => selectVideo(file)}>
            <h3 className="font-medium text-sm truncate" title={file.name}>
              {file.name}
            </h3>
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge variant="secondary" className="text-xs">
                {formatFileSize(file.size)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {file.mimeType === "application/zip" ? "ZIP" : file.mimeType.split("/")[1]?.toUpperCase()}
              </Badge>
              {favorites.has(file.id) && (
                <Badge variant="destructive" className="text-xs">
                  <Heart className="h-3 w-3 mr-1" />
                  Favorite
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{formatDate(file.modifiedTime)}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  console.log("[v0] Play clicked for:", file.name)
                  selectVideo(file)
                }}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Play
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  console.log("[v0] Favorite clicked for:", file.name)
                  toggleFavorite(file)
                }}
              >
                <Heart className={`h-4 w-4 mr-2 ${favorites.has(file.id) ? "fill-current" : ""}`} />
                {favorites.has(file.id) ? "Remove from Favorites" : "Add to Favorites"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  console.log("[v0] Share clicked for:", file.name)
                  shareVideo(file)
                }}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </DropdownMenuItem>
              {!showPlaylistOptions && playlists.length > 0 && (
                <>
                  {playlists.map((playlist) => (
                    <DropdownMenuItem
                      key={playlist.id}
                      onClick={() => {
                        console.log("[v0] Add to playlist clicked:", playlist.name)
                        addToPlaylist(file, playlist.id)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add to {playlist.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              {showPlaylistOptions && playlistId && (
                <DropdownMenuItem
                  onClick={() => {
                    console.log("[v0] Remove from playlist clicked")
                    removeFromPlaylist(file.id, playlistId)
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove from Playlist
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )

  if (!isAuthReady && error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Google Drive Video Player</h1>
            <p className="text-gray-600">Stream videos directly from your Google Drive shared folders</p>
          </div>

          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuration Required</AlertTitle>
            <AlertDescription className="mt-2">{error}</AlertDescription>
          </Alert>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Setup Instructions:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
              <li>
                Go to the{" "}
                <a
                  href="https://console.cloud.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google Cloud Console
                </a>
              </li>
              <li>Create a new project or select an existing one</li>
              <li>Enable the Google Drive API</li>
              <li>Create OAuth 2.0 credentials (Web application)</li>
              <li>Add your domain to authorized origins</li>
              <li>Copy the Client ID</li>
              <li>
                Add it as <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in Project
                Settings
              </li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Google Drive Video Player</h1>
          <p className="text-gray-600">Stream videos directly from your Google Drive shared folders</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-red-800 font-medium">Configuration Error</p>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!user ? (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Sign in with Google
              </CardTitle>
              <CardDescription>Access your Google Drive to stream videos from shared folders</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={signInWithGoogle} className="w-full" disabled={!isAuthReady}>
                <LogIn className="mr-2 h-4 w-4" />
                {isAuthReady ? "Sign in with Google" : "Loading Google Auth..."}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Welcome, {user?.name}
                </CardTitle>
                <Button variant="outline" onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src={user?.picture || "/placeholder.svg"}
                  alt={user?.name}
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                />
                <div>
                  <p className="font-medium">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              {sharedFolders.length > 0 && (
                <div className="space-y-2">
                  <Label>Select a shared folder:</Label>
                  <Select value={selectedFolderId} onValueChange={handleFolderSelect}>
                    <SelectTrigger>
                      <FolderOpen className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Choose a folder..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sharedFolders.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {sharedFolders.length === 0 && !loading && (
                <Alert>
                  <AlertDescription>
                    No shared folders found. Make sure you have folders shared with you that contain videos.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {selectedVideo && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Now Playing: {selectedVideo.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleFavorite(selectedVideo)}>
                    <Heart className={`h-4 w-4 mr-2 ${favorites.has(selectedVideo.id) ? "fill-current" : ""}`} />
                    {favorites.has(selectedVideo.id) ? "Favorited" : "Add to Favorites"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(getDownloadUrl(selectedVideo), "_blank")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <VideoPlayer
                src={getStreamUrl(selectedVideo)}
                embedSrc={getEmbedUrl(selectedVideo)}
                title={selectedVideo.name}
                onNext={handleNext}
                onPrevious={handlePrevious}
                onError={() => {
                  console.error("Failed to load video:", selectedVideo.name)
                }}
              />
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>Size: {formatFileSize(selectedVideo.size)}</span>
                <span>Type: {selectedVideo.mimeType.split("/")[1]?.toUpperCase()}</span>
                <span>Modified: {formatDate(selectedVideo.modifiedTime)}</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                <p>Keyboard shortcuts: Space (play/pause), ← → (seek), ↑ ↓ (volume), F (fullscreen), M (mute)</p>
              </div>
            </CardContent>
          </Card>
        )}

        {files.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Folder className="h-5 w-5" />
                  Video Library
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Dialog open={showCreatePlaylist} onOpenChange={setShowCreatePlaylist}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        New Playlist
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Playlist</DialogTitle>
                        <DialogDescription>Enter a name for your new playlist</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input
                          placeholder="Playlist name"
                          value={newPlaylistName}
                          onChange={(e) => setNewPlaylistName(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && createPlaylist()}
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowCreatePlaylist(false)}>
                            Cancel
                          </Button>
                          <Button onClick={createPlaylist} disabled={!newPlaylistName.trim()}>
                            Create
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                  >
                    {viewMode === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all">All Videos ({files.length})</TabsTrigger>
                  <TabsTrigger value="favorites">
                    <Heart className="h-4 w-4 mr-2" />
                    Favorites ({favorites.size})
                  </TabsTrigger>
                  <TabsTrigger value="recent">
                    <Clock className="h-4 w-4 mr-2" />
                    Recent ({Math.min(watchHistory.length, 20)})
                  </TabsTrigger>
                  <TabsTrigger value="playlists">Playlists ({playlists.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search videos..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={filterType}
                        onValueChange={(value) => {
                          console.log("[v0] Filter type changed to:", value)
                          setFilterType(value)
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {videoTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={sortBy}
                        onValueChange={(value) => {
                          console.log("[v0] Sort by changed to:", value)
                          setSortBy(value as SortOption)
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="size">Size</SelectItem>
                          <SelectItem value="type">Type</SelectItem>
                          <SelectItem value="modified">Modified</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          console.log("[v0] Sort direction button clicked")
                          toggleSortDirection()
                        }}
                      >
                        {sortDirection === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAndSortedFiles.map((file) => (
                      <VideoCard key={file.id} file={file} />
                    ))}
                  </div>

                  {filteredAndSortedFiles.length === 0 && searchQuery && (
                    <div className="text-center py-8 text-muted-foreground">
                      No videos found matching "{searchQuery}"
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="favorites">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {files
                      .filter((file) => favorites.has(file.id))
                      .map((file) => (
                        <VideoCard key={file.id} file={file} />
                      ))}
                  </div>
                  {favorites.size === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No favorite videos yet. Click the heart icon on any video to add it to favorites.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="recent">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {watchHistory.slice(0, 20).map((item) => (
                      <VideoCard key={item.file.id} file={item.file} />
                    ))}
                  </div>
                  {watchHistory.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No recently watched videos. Start watching videos to see them here.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="playlists" className="space-y-4">
                  {playlists.map((playlist) => (
                    <Card key={playlist.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{playlist.name}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{playlist.files.length} videos</Badge>
                            <Button variant="outline" size="sm" onClick={() => deletePlaylist(playlist.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {playlist.files.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {playlist.files.map((file) => (
                              <VideoCard key={file.id} file={file} showPlaylistOptions playlistId={playlist.id} />
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            This playlist is empty. Add videos from the main library.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {playlists.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No playlists created yet. Click "New Playlist" to create your first playlist.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {files.length === 0 && !loading && isAuthenticated && (
          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">1. Share a folder:</h4>
                <p className="text-sm text-muted-foreground">
                  Share a folder with "Anyone with the link" permissions to access it.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">2. Select the folder:</h4>
                <p className="text-sm text-muted-foreground">
                  Use the dropdown menu to select the folder you want to stream videos from.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

declare global {
  interface Window {
    google: any
  }
}
