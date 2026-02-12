// Gong API Types

export interface GongUser {
  id: string
  emailAddress: string
  firstName: string
  lastName: string
  active: boolean
}

export interface GongCall {
  metaData: {
    id: string
    title: string
    scheduled: string
    started: string
    duration: number
    primaryUserId: string
    direction: string
    system: string
    scope: string
    media: string
    language: string
    workspaceId: string
    url: string
  }
  parties: Array<{
    id: string
    emailAddress?: string
    name?: string
    title?: string
    userId?: string
    affiliation: string
  }>
}

export interface GongCallsResponse {
  calls: GongCall[]
  records: {
    totalRecords: number
    currentPageSize: number
    currentPageNumber: number
  }
}

export interface GongUsersResponse {
  users: GongUser[]
}

export interface GongTranscript {
  callId: string
  transcript: Array<{
    speakerId: string
    topic: string
    sentences: Array<{
      start: number
      end: number
      text: string
    }>
  }>
}
