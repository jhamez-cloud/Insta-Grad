import { notFound } from "next/navigation"
import { LibraryDocuments } from "@/components/library/library-documents"

export default async function LibraryDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^[1-9]\d*$/.test(id)) notFound()
  return <LibraryDocuments key={id} libraryId={id} />
}
