'use client'
import { useState, ChangeEvent } from 'react'
import { supabase, FileType } from '@/utils/supabase/supabaseClient'
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState<boolean>(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false)
  const [fileUrl, setFileUrl] = useState<string>('')
  const [pageId, setPageId] = useAtom(urlId)
  const [pageType, setPageType] = useAtom(urlType)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return
    
    try {
      setUploading(true)
      setUploadError(null)
      
      // File validation
      const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
      const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
      
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds 5MB limit')
      }
      
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error('Only JPEG, PNG, and PDF files are allowed')
      }
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      // Create a custom upload function with progress tracking
      const uploadWithProgress = async () => {
        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100
            setUploadProgress(percentComplete)
          }
        })

        const formData = new FormData()
        formData.append('file', file)

        // Get upload URL from Supabase
        const { data: uploadData, error: urlError } = await supabase.storage
          .from('attachments')
          .createSignedUploadUrl(filePath)

        if (urlError) throw urlError

        return new Promise((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(xhr.response)
            } else {
              reject(new Error('Upload failed'))
            }
          }
          xhr.onerror = () => reject(new Error('Upload failed'))
          xhr.open('PUT', uploadData.signedUrl, true)
          xhr.send(formData)
        })
      }

      // Perform the upload
      await uploadWithProgress()

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath)
      
      setFileUrl(publicUrl)
      setUploadSuccess(true)
      
      // Store metadata in database
      const { error: dbError } = await supabase
        .from('attachment')
        .insert([{
          name: file.name,
          source_id: urlId,
          source_type: urlType,
          meta: {
            url: publicUrl,
            size: file.size,
            type: file.type
          },
          path: filePath,
        }])
      
      if (dbError) throw dbError
      
    } catch (error: unknown) {
      if (error instanceof Error) {
        setUploadError(error.message)
      } else {
        setUploadError('An unknown error occurred')
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 border rounded">
      <h2 className="text-xl font-bold mb-4">Upload Attachment</h2>
      
      <input 
        type="file" 
        onChange={handleFileChange}
        className="mb-4"
        accept="image/jpeg, image/png, application/pdf"
      />
      
      <button
        onClick={handleUpload}
        disabled={uploading || !file}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
      
      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      )}
      
      {uploadError && (
        <p className="text-red-500 mt-2">{uploadError}</p>
      )}
      
      {uploadSuccess && (
        <div className="mt-4 p-2 bg-green-100 rounded">
          <p className="text-green-800">Upload successful!</p>
          {fileUrl && (
            <a 
              href={fileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 underline mt-2 block"
            >
              View File
            </a>
          )}
        </div>
      )}
    </div>
  )
}   

// export function FileUpload2() {
//   const [file, setFile] = useState<File | null>(null)
//   const [uploading, setUploading] = useState<boolean>(false)
//   const [uploadProgress, setUploadProgress] = useState<number>(0)
//   const [uploadError, setUploadError] = useState<string | null>(null)
//   const [uploadSuccess, setUploadSuccess] = useState<boolean>(false)
//   const [fileUrl, setFileUrl] = useState<string>('')

//   const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files && e.target.files[0]) {
//       setFile(e.target.files[0])
//     }
//   }

//   const handleUpload = async () => {
//     if (!file) return
    
//     try {
//       setUploading(true)
//       setUploadError(null)
      
//       // File validation
//       const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
//       const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
      
//       if (file.size > MAX_FILE_SIZE) {
//         throw new Error('File size exceeds 5MB limit')
//       }
      
//       if (!ALLOWED_TYPES.includes(file.type)) {
//         throw new Error('Only JPEG, PNG, and PDF files are allowed')
//       }
      
//       // Generate unique filename
//       const fileExt = file.name.split('.').pop()
//       const fileName = `${Math.random()}.${fileExt}`
//       const filePath = `${fileName}`
      
//       // Upload file with progress tracking
//       const { data, error } = await supabase.storage
//         .from('attachments')
//         .upload(filePath, file, {
//           cacheControl: '3600',
//           upsert: false,
//           contentType: file.type,
//         }, {
//           onProgress: (progress) => {
//             if (progress.total) {
//               setUploadProgress((progress.loaded / progress.total) * 100)
//             }
//           }
//         })
      
//       if (error) throw error
      
//       // Get public URL
//       const { data: { publicUrl } } = supabase.storage
//         .from('attachments')
//         .getPublicUrl(filePath)
      
//       setFileUrl(publicUrl)
//       setUploadSuccess(true)
      
//       // Store metadata in database
//       const fileData: Omit<FileType, 'id' | 'created_at'> = {
//         name: file.name,
//         url: publicUrl,
//         path: filePath,
//         size: file.size,
//         type: file.type
//       }
      
//       const { error: dbError } = await supabase
//         .from('attachments')
//         .insert([fileData])
      
//       if (dbError) throw dbError
      
//     } catch (error: unknown) {
//       if (error instanceof Error) {
//         setUploadError(error.message)
//       } else {
//         setUploadError('An unknown error occurred')
//       }
//     } finally {
//       setUploading(false)
//     }
//   }

