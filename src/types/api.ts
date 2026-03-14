export interface Result<T> {
  code: number
  message: string
  data: T
}

export interface PageResult<T> {
  total: number
  pageNum: number
  pageSize: number
  list: T[]
}

export enum TagType {
  STRING = 'STRING',
  LONG = 'LONG',
  DOUBLE = 'DOUBLE',
  BOOLEAN = 'BOOLEAN',
  ENUM = 'ENUM',
  DATE = 'DATE',
}

export const TagTypeLabels: Record<TagType, string> = {
  [TagType.STRING]: '字符串',
  [TagType.LONG]: '长整型',
  [TagType.DOUBLE]: '浮点型',
  [TagType.BOOLEAN]: '布尔型',
  [TagType.ENUM]: '枚举',
  [TagType.DATE]: '日期',
}

export interface TagDefinitionDTO {
  id: number
  tagKey: string
  tagName: string
  tagType: TagType
  category: string
  description: string
  enumValues: string[] | null
  status: number
  createdBy: string
  createdTime: string
  updatedTime: string
}

export interface TagDefinitionCreateRequest {
  tagKey: string
  tagName: string
  tagType: TagType
  category?: string
  description?: string
  enumValues?: string[]
}

export interface TagDefinitionUpdateRequest {
  tagName: string
  tagType: TagType
  category?: string
  description?: string
  enumValues?: string[]
}

export interface TagValueDTO {
  userId: string
  tagKey: string
  tagValue: string
}

export interface TagValueWriteRequest {
  userId: string
  tagKey: string
  tagValue: string
}

export interface TagValueBatchWriteRequest {
  items: TagValueWriteRequest[]
}

export interface UserTagsDTO {
  userId: string
  tags: Record<string, string>
}
