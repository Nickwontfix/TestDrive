"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import {
  Search,
  Play,
  Heart,
  Plus,
  Folder,
  ArrowLeft,
  List,
  SortAsc,
  SortDesc,
  Clock,
  CheckCircle,
  PlayCircle,
  User,
  LogOut,
  Filter,
  Archive,
  Video,
  MoreVertical,
  Share2,
  Trash2,
  AlertCircle,
  FolderOpen,
  LayoutGrid,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { VideoPlayer } from "@/components/video-player"
import JSZip from "jszip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface GoogleUser {
  name: string
  email: string
  picture: string
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  webContentLink?: string
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
  progress: number
}

interface Playlist {
  id: string
  name: string
  files: DriveFile[]
  createdAt: number
}

type SortOption = "name" | "size" | "type" | "modified" | "date" | "watched" | "progress"
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

const naturalSort = (a: string, b: string): number => {
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  })
  return collator.compare(a, b)
}

export default function GoogleDriveVideoPlayer() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [accessToken, setAccessToken] = useState("")
  const [sharedFolders, setSharedFolders] = useState<DriveFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState("")

  const [files, setFiles] = useState<DriveFile[]>([])
  const [currentFolders, setCurrentFolders] = useState<DriveFile[]>([])
  const [currentPath, setCurrentPath] = useState<{ id: string; name: string }[]>([])
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
  const [videoProgress, setVideoProgress] = useState<
    Record<string, { progress: number; duration: number; lastWatched: number }>
  >({})
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [newPlaylistName, setNewPlaylistName] = useState("")
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [sortOrder, setSortOrder] = useState<SortDirection>("asc")

  useEffect(() => {
    // Restore session from localStorage
    const savedAuth = localStorage.getItem("drive-streamer-auth")
    const savedUser = localStorage.getItem("drive-streamer-user")
    const savedProgress = localStorage.getItem("drive-streamer-progress")

    if (savedAuth && savedUser) {
      try {
        const authData = JSON.parse(savedAuth)
        const userData = JSON.parse(savedUser)

        // Check if token is still valid (basic check)
        if (authData.accessToken && authData.expiresAt > Date.now()) {
          setAccessToken(authData.accessToken)
          setUser(userData)
          setIsAuthenticated(true)
          console.log("[v0] Session restored from localStorage")

          // Discover folders with restored token
          discoverSharedFolders(authData.accessToken)
        } else {
          // Clear expired session
          localStorage.removeItem("drive-streamer-auth")
          localStorage.removeItem("drive-streamer-user")
        }
      } catch (error) {
        console.error("[v0] Error restoring session:", error)
        localStorage.removeItem("drive-streamer-auth")
        localStorage.removeItem("drive-streamer-user")
      }
    }

    if (savedProgress) {
      try {
        setVideoProgress(JSON.parse(savedProgress))
      } catch (error) {
        console.error("[v0] Error parsing saved progress:", error)
        localStorage.removeItem("drive-streamer-progress")
      }
    }

    initializeGoogleAuthWithRetry()
  }, [])

  const initializeGoogleAuthWithRetry = () => {
    let retryCount = 0
    const maxRetries = 10
    const retryDelay = 500

    const tryInitialize = () => {
      if (typeof window !== "undefined" && window.google?.accounts?.oauth2) {
        initializeGoogleAuth()
        return
      }

      retryCount++
      if (retryCount < maxRetries) {
        console.log(`[v0] Google APIs not ready, retrying... (${retryCount}/${maxRetries})`)
        setTimeout(tryInitialize, retryDelay)
      } else {
        console.error("[v0] Failed to load Google APIs after maximum retries")
        setError("Failed to load Google authentication. Please refresh the page and try again.")
        setIsAuthReady(false)
      }
    }

    tryInitialize()
  }

  useEffect(() => {
    localStorage.setItem("drive-streamer-progress", JSON.stringify(videoProgress))
  }, [videoProgress])

  const initializeGoogleAuth = () => {
    console.log("[v0] Initializing Google Identity Services")

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    console.log("[v0] Client ID check:", clientId ? "Present" : "Missing", clientId?.substring(0, 20) + "...")

    if (!clientId || clientId === "YOUR_GOOGLE_CLIENT_ID") {
      console.log("[v0] Client ID validation failed")
      setError(
        "Google Client ID not configured. Please add NEXT_PUBLIC_GOOGLE_CLIENT_ID to your environment variables in Project Settings.",
      )
      setIsAuthReady(false)
      return
    }

    if (typeof window !== "undefined" && window.google?.accounts?.oauth2) {
      console.log("[v0] Initializing token client")
      try {
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
            const expiresAt = Date.now() + response.expires_in * 1000 // Convert to milliseconds
            setAccessToken(response.access_token)

            localStorage.setItem(
              "drive-streamer-auth",
              JSON.stringify({
                accessToken: response.access_token,
                expiresAt: expiresAt,
              }),
            )

            // Get user profile information
            fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${response.access_token}`)
              .then((res) => res.json())
              .then((userInfo) => {
                console.log("[v0] User info received:", userInfo)
                const userData = {
                  name: userInfo.name,
                  email: userInfo.email,
                  picture: userInfo.picture,
                }
                setUser(userData)
                setIsAuthenticated(true)
                setError("")

                localStorage.setItem("drive-streamer-user", JSON.stringify(userData))

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
        ;(window as any).tokenClient = tokenClient
        setIsAuthReady(true)
        setError("") // Clear any previous errors on successful initialization
        console.log("[v0] Google Identity Services initialized successfully")
      } catch (error: any) {
        console.error("[v0] GIS initialization failed:", error)
        setError(`Failed to initialize Google authentication: ${error.message}`)
        setIsAuthReady(false)
      }
    } else {
      console.log("[v0] Google APIs not available")
      setError("Google Identity Services not loaded properly")
      setIsAuthReady(false)
    }
  }

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
        window.google.accounts.oauth2.revoke(accessToken, () => {
          console.log("[v0] Token revoked successfully")
        })
      }

      localStorage.removeItem("drive-streamer-auth")
      localStorage.removeItem("drive-streamer-user")

      // Clear application state
      setIsAuthenticated(false)
      setUser(null)
      setAccessToken("")
      setFiles([])
      setSharedFolders([])
      setSelectedFolderId("")
      setSelectedVideo(null)
      setError("")
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
        `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and sharedWithMe=true&fields=files(id,name,webViewLink)&pageSize=1000&access_token=${token}`,
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
        setCurrentPath([{ id: data.files[0].id, name: data.files[0].name }])
        fetchFolderContents(data.files[0].id, token)
      }
    } catch (err: any) {
      console.error("[v0] Error discovering folders:", err)
      setError(err instanceof Error ? err.message : "Failed to discover folders")
    } finally {
      setLoading(false)
    }
  }

  const fetchFolderContents = async (folderId: string, token?: string) => {
    const authToken = token || accessToken
    if (!authToken || !folderId) {
      console.error("[v0] Missing auth token or folder ID")
      return
    }

    setLoading(true)
    setError("")

    try {
      console.log("[v0] Fetching contents of folder:", folderId)

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType,webViewLink,webContentLink,thumbnailLink,size,modifiedTime,parents)&pageSize=1000&access_token=${authToken}`,
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] Failed to fetch folder contents:", response.status, errorText)
        throw new Error(`Failed to fetch folder contents: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const allFiles = data.files || []

      const videoFiles: DriveFile[] = []
      const zipFiles: DriveFile[] = []
      const folderFiles: DriveFile[] = []

      allFiles.forEach((file: DriveFile) => {
        if (file.mimeType === "application/vnd.google-apps.folder") {
          folderFiles.push(file)
        } else if (file.mimeType === "application/zip" || file.name.toLowerCase().endsWith(".zip")) {
          zipFiles.push(file)
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

      console.log(
        "[v0] Found in folder:",
        videoFiles.length,
        "videos,",
        zipFiles.length,
        "zip files,",
        folderFiles.length,
        "subfolders",
      )

      setFiles([...videoFiles, ...zipFiles])
      setCurrentFolders(folderFiles)

      if (videoFiles.length === 0 && zipFiles.length === 0 && folderFiles.length === 0) {
        setError("This folder is empty")
      }
    } catch (err: any) {
      console.error("[v0] Error fetching folder contents:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
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

      let nextPageToken = ""
      const allFiles: DriveFile[] = []

      do {
        const pageTokenParam = nextPageToken ? `&pageToken=${nextPageToken}` : ""
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType,webViewLink,webContentLink,thumbnailLink,size,modifiedTime,parents),nextPageToken&pageSize=1000${pageTokenParam}&access_token=${authToken}`,
        )

        if (!response.ok) {
          console.error("[v0] Failed to fetch from folder:", folderId, response.status)
          break
        }

        const data = await response.json()
        const files = data.files || []
        allFiles.push(...files)

        nextPageToken = data.nextPageToken || ""
        console.log(
          "[v0] Fetched",
          files.length,
          "files from folder",
          folderId,
          nextPageToken ? "(more pages available)" : "(last page)",
        )
      } while (nextPageToken)

      // Separate videos and folders
      const videoFiles: DriveFile[] = []
      const subFolders: DriveFile[] = []

      allFiles.forEach((file: DriveFile) => {
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

      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&access_token=${accessToken}`

      const response = await fetch(downloadUrl)

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
        setFiles((prev) => {
          const withoutZip = prev.filter((f) => f.id !== file.id)
          return [...withoutZip, ...videoFiles]
        })

        setError(`Successfully extracted ${videoFiles.length} videos from ${file.name}`)
        setTimeout(() => setError(""), 3000)

        // Auto-select first extracted video
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
          comparison = naturalSort(a.name, b.name)
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
    fetchFolderContents(folderId, accessToken)
  }

  const navigateToFolder = (folder: DriveFile) => {
    const newPath = [...currentPath, { id: folder.id, name: folder.name }]
    setCurrentPath(newPath)
    fetchFolderContents(folder.id)
  }

  const navigateToPath = (pathIndex: number) => {
    const newPath = currentPath.slice(0, pathIndex + 1)
    setCurrentPath(newPath)
    const targetFolderId = newPath[newPath.length - 1]?.id || selectedFolderId
    fetchFolderContents(targetFolderId)
  }

  const navigateBack = () => {
    if (currentPath.length > 0) {
      const newPath = currentPath.slice(0, -1)
      setCurrentPath(newPath)
      const targetFolderId = newPath[newPath.length - 1]?.id || selectedFolderId
      fetchFolderContents(targetFolderId)
    }
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
  }: { file: DriveFile; showPlaylistOptions?: boolean; playlistId?: string }) => {
    const isZipFile = file.mimeType === "application/zip" || file.name.toLowerCase().endsWith(".zip")

    return (
      <Card
        key={file.id}
        className={`cursor-pointer transition-colors hover:bg-accent ${
          selectedVideo?.id === file.id ? "ring-2 ring-primary" : ""
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0"
              onClick={() => {
                if (isZipFile) {
                  extractAndPlayZip(file)
                } else {
                  selectVideo(file)
                }
              }}
            >
              {isZipFile ? <Archive className="h-8 w-8 text-orange-500" /> : <Video className="h-8 w-8 text-primary" />}
            </div>
            <div
              className="flex-1 min-w-0"
              onClick={() => {
                if (isZipFile) {
                  extractAndPlayZip(file)
                } else {
                  selectVideo(file)
                }
              }}
            >
              <h3 className="font-medium text-sm truncate" title={file.name}>
                {file.name}
              </h3>
              <div className="flex flex-wrap gap-1 mt-2">
                <Badge variant="secondary" className="text-xs">
                  {formatFileSize(file.size)}
                </Badge>
                <Badge variant={isZipFile ? "destructive" : "outline"} className="text-xs">
                  {isZipFile ? "ZIP ARCHIVE" : file.mimeType.split("/")[1]?.toUpperCase()}
                </Badge>
                {favorites.has(file.id) && !isZipFile && (
                  <Badge variant="destructive" className="text-xs">
                    <Heart className="h-3 w-3 mr-1" />
                    Favorite
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isZipFile ? "Click to extract videos" : formatDate(file.modifiedTime)}
              </p>
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
                    if (isZipFile) {
                      console.log("[v0] Extract clicked for:", file.name)
                      extractAndPlayZip(file)
                    } else {
                      console.log("[v0] Play clicked for:", file.name)
                      selectVideo(file)
                    }
                  }}
                >
                  {isZipFile ? (
                    <>
                      <Archive className="h-4 w-4 mr-2" />
                      Extract Videos
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Play
                    </>
                  )}
                </DropdownMenuItem>
                {!isZipFile && (
                  <>
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
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    )
  }

  const updateVideoProgress = (videoId: string, currentTime: number, duration: number) => {
    console.log("[v0] Updating progress for video:", videoId, "time:", currentTime, "duration:", duration)

    const newProgress = {
      ...videoProgress,
      [videoId]: {
        progress: currentTime,
        duration: duration,
        lastWatched: Date.now(),
      },
    }
    setVideoProgress(newProgress)

    const percentage = duration > 0 ? Math.round((currentTime / duration) * 100) : 0
    console.log("[v0] Progress percentage:", percentage, "Watched status:", percentage >= 90)

    localStorage.setItem("drive-streamer-progress", JSON.stringify(newProgress))

    // Trigger a state update to refresh the UI
    setTimeout(() => {
      setVideoProgress((prev) => ({ ...prev }))
    }, 100)
  }

  const markVideoAsWatched = (videoId: string) => {
    console.log("[v0] Manually marking video as watched:", videoId)
    updateVideoProgress(videoId, 3600, 3600) // Mark as fully watched
  }

  const markVideoProgress = (videoId: string, percentage: number) => {
    console.log("[v0] Manually setting video progress:", videoId, percentage + "%")
    const simulatedDuration = 3600
    const currentTime = (percentage / 100) * simulatedDuration
    updateVideoProgress(videoId, currentTime, simulatedDuration)
  }

  const getVideoProgress = (videoId: string) => {
    return videoProgress[videoId] || { progress: 0, duration: 0, lastWatched: 0 }
  }

  const getProgressPercentage = (videoId: string) => {
    const progress = getVideoProgress(videoId)
    if (progress.duration === 0) return 0
    return Math.round((progress.progress / progress.duration) * 100)
  }

  const isVideoWatched = (videoId: string) => {
    return getProgressPercentage(videoId) >= 90 // Consider 90%+ as watched
  }

  const sortFiles = (filesToSort: DriveFile[]) => {
    return [...filesToSort].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case "name":
          comparison = naturalSort(a.name, b.name)
          break
        case "date":
          comparison = new Date(a.modifiedTime || 0).getTime() - new Date(b.modifiedTime || 0).getTime()
          break
        case "size":
          comparison = (Number.parseInt(a.size || "0") || 0) - (Number.parseInt(b.size || "0") || 0)
          break
        case "watched":
          const aWatched = isVideoWatched(a.id)
          const bWatched = isVideoWatched(b.id)
          if (aWatched && !bWatched) comparison = -1
          else if (!aWatched && bWatched) comparison = 1
          else comparison = 0
          break
        case "progress":
          const aProgress = getProgressPercentage(a.id)
          const bProgress = getProgressPercentage(b.id)
          comparison = aProgress - bProgress
          break
        default:
          comparison = 0
      }

      return sortDirection === "asc" ? comparison : -comparison
    })
  }

  const getWatchedVideos = () => {
    return sortFiles(files.filter((file) => isVideoWatched(file.id)))
  }

  const getUnwatchedVideos = () => {
    return sortFiles(files.filter((file) => !isVideoWatched(file.id)))
  }

  const getCurrentVideoIndex = () => {
    if (!selectedVideo) return -1
    const sortedFiles = sortFiles(files)
    return sortedFiles.findIndex((file) => file.id === selectedVideo.id)
  }

  const getNextVideo = () => {
    const sortedFiles = sortFiles(files)
    const currentIndex = getCurrentVideoIndex()
    if (currentIndex >= 0 && currentIndex < sortedFiles.length - 1) {
      return sortedFiles[currentIndex + 1]
    }
    return null
  }

  const getPreviousVideo = () => {
    const sortedFiles = sortFiles(files)
    const currentIndex = getCurrentVideoIndex()
    if (currentIndex > 0) {
      return sortedFiles[currentIndex - 1]
    }
    return null
  }

  const handleVideoSelect = (file: DriveFile) => {
    selectVideo(file)
    setVideoProgress((prev) => ({ ...prev }))
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">Google Drive Video Player</CardTitle>
            <CardDescription>Sign in with your Google account to access your videos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <Button onClick={signInWithGoogle} disabled={!isAuthReady} className="w-full bg-blue-600 hover:bg-blue-700">
              <User className="mr-2 h-4 w-4" />
              {isAuthReady ? "Sign in with Google" : "Loading..."}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (selectedVideo) {
    const nextVideo = getNextVideo()
    const previousVideo = getPreviousVideo()

    const upNextVideos = getUnwatchedVideos()

    return (
      <div className="min-h-screen bg-black">
        <div className="h-screen w-screen max-w-full grid grid-cols-[15vw_1fr_15vw] md:grid-cols-[18vw_1fr_18vw] lg:grid-cols-[20vw_1fr_20vw] overflow-hidden">
          <div className="bg-gray-900 border-r border-gray-700 flex flex-col overflow-hidden min-w-0">
            <div className="p-2 md:p-3 border-b border-gray-700 flex-shrink-0">
              <h3 className="text-white font-semibold flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                <PlayCircle className="h-3 w-3 md:h-4 md:w-4 text-blue-500" />
                <span className="hidden sm:inline">Up Next</span> ({getUnwatchedVideos().length})
              </h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-1 md:p-2 space-y-1 md:space-y-2">
                {upNextVideos.map((video, index) => (
                  <div
                    key={video.id}
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedVideo?.id === video.id
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                    }`}
                    onClick={() => setSelectedVideo(video)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" title={video.name}>
                          {video.name}
                        </p>
                        <div className="w-full bg-gray-600 rounded-full h-1.5 mt-1">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${getProgressPercentage(video.id)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-400">{getProgressPercentage(video.id)}% watched</span>
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                markVideoProgress(video.id, 100)
                              }}
                              className="text-xs px-1 py-0.5 bg-green-600 hover:bg-green-700 rounded text-white"
                            >
                              ✓
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Center - Video Player */}
          <div className="flex flex-col min-w-0 overflow-hidden">
            <div className="p-2 md:p-3 bg-gray-900 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
              <Button
                variant="ghost"
                onClick={() => setSelectedVideo(null)}
                className="text-white hover:bg-gray-800 text-xs md:text-sm"
              >
                <ArrowLeft className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                <span className="hidden md:inline">Back to Library</span>
              </Button>
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-24 md:w-32 bg-gray-800 border-gray-700 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="name" className="text-white">
                      Name
                    </SelectItem>
                    <SelectItem value="date" className="text-white">
                      Date
                    </SelectItem>
                    <SelectItem value="size" className="text-white">
                      Size
                    </SelectItem>
                    <SelectItem value="progress" className="text-white">
                      Progress
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="text-white hover:bg-gray-800 p-1 md:p-2"
                >
                  {sortOrder === "asc" ? (
                    <ArrowUp className="h-3 w-3 md:h-4 md:w-4" />
                  ) : (
                    <ArrowDown className="h-3 w-3 md:h-4 md:w-4" />
                  )}
                </Button>
                <Button variant="ghost" onClick={signOut} className="text-white hover:bg-gray-800 text-xs p-1 md:p-2">
                  <LogOut className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden lg:inline ml-1">Sign Out</span>
                </Button>
              </div>
            </div>
            <div className="flex-1 p-2 md:p-3 overflow-hidden">
              <VideoPlayer
                src={`https://drive.google.com/uc?export=download&id=${selectedVideo.id}&access_token=${accessToken}`}
                title={selectedVideo.name}
                onError={() => setError("Failed to load video")}
                onNext={nextVideo ? () => handleVideoSelect(nextVideo) : undefined}
                onPrevious={previousVideo ? () => handleVideoSelect(previousVideo) : undefined}
                onProgress={(currentTime, duration) => updateVideoProgress(selectedVideo.id, currentTime, duration)}
              />
            </div>
          </div>

          <div className="bg-gray-900 border-l border-gray-700 flex flex-col overflow-hidden min-w-0">
            <div className="p-2 md:p-3 border-b border-gray-700 flex-shrink-0">
              <h3 className="text-white font-semibold flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
                <span className="hidden sm:inline">Watched</span> ({getWatchedVideos().length})
              </h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-1 md:p-2 space-y-1 md:space-y-2">
                {getWatchedVideos().map((file) => (
                  <Card
                    key={file.id}
                    className={`cursor-pointer transition-colors bg-gray-800 border-gray-700 hover:bg-gray-700 ${
                      selectedVideo?.id === file.id ? "ring-2 ring-blue-500" : ""
                    }`}
                    onClick={() => handleVideoSelect(file)}
                  >
                    <CardContent className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-shrink-0">
                          <img
                            src={`https://drive.google.com/thumbnail?id=${file.id}&sz=w60-h40`}
                            alt={file.name}
                            className="w-8 h-6 md:w-10 md:h-7 object-cover rounded bg-gray-700"
                            onError={(e) => {
                              e.currentTarget.style.display = "none"
                              e.currentTarget.nextElementSibling?.classList.remove("hidden")
                            }}
                          />
                          <div className="hidden w-8 h-6 md:w-10 md:h-7 bg-gray-700 rounded flex items-center justify-center">
                            <Video className="h-2 w-2 md:h-3 md:w-3 text-gray-400" />
                          </div>
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate" title={file.name}>
                            {file.name}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Progress value={getProgressPercentage(file.id)} className="flex-1 h-1" />
                            <span className="text-xs text-gray-400 hidden md:inline">
                              {getProgressPercentage(file.id)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
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
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-gray-900">Google Drive Video Player</CardTitle>
              <CardDescription>Sign in with your Google account to access your videos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              <Button
                onClick={signInWithGoogle}
                disabled={!isAuthReady}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <User className="mr-2 h-4 w-4" />
                {isAuthReady ? "Sign in with Google" : "Loading..."}
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

        {selectedFolderId && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <button
                onClick={() => {
                  setCurrentPath([])
                  fetchFolderContents(selectedFolderId)
                }}
                className="hover:text-white transition-colors"
              >
                {sharedFolders.find((f) => f.id === selectedFolderId)?.name || "Root"}
              </button>
              {currentPath.map((pathItem, index) => (
                <div key={pathItem.id} className="flex items-center gap-2">
                  <span>/</span>
                  <button onClick={() => navigateToPath(index)} className="hover:text-white transition-colors">
                    {pathItem.name}
                  </button>
                </div>
              ))}
              {currentPath.length > 0 && (
                <button
                  onClick={navigateBack}
                  className="ml-4 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                >
                  ← Back
                </button>
              )}
            </div>

            {currentFolders.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Folder className="h-5 w-5" />
                  Folders ({currentFolders.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {currentFolders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => navigateToFolder(folder)}
                      className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 cursor-pointer hover:bg-gray-700/50 transition-all duration-200 border border-gray-700/50 hover:border-blue-500/50"
                    >
                      <div className="flex items-center gap-3">
                        <Folder className="h-8 w-8 text-blue-400" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-white truncate">{folder.name}</h3>
                          <p className="text-sm text-gray-400">Folder</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {files.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Videos in this folder ({filteredAndSortedFiles.length})
                </h3>
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
                              {sortDirection === "asc" ? (
                                <SortAsc className="h-4 w-4" />
                              ) : (
                                <SortDesc className="h-4 w-4" />
                              )}
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
              </div>
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
