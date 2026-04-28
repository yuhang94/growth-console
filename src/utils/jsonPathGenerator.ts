export interface JsonPathSuggestion {
  jsonPath: string
  fieldName: string
  sampleValue: unknown
  inferredType: string
}

export function generateJsonPathSuggestions(jsonStr: string): JsonPathSuggestion[] {
  let root: unknown
  try {
    root = JSON.parse(jsonStr)
  } catch {
    return []
  }
  const results: JsonPathSuggestion[] = []
  traverse(root, '$', results, 0)
  return results
}

function traverse(node: unknown, currentPath: string, results: JsonPathSuggestion[], depth: number) {
  if (depth > 10) return

  if (node === null || node === undefined) {
    results.push({
      jsonPath: currentPath,
      fieldName: extractFieldName(currentPath),
      sampleValue: node,
      inferredType: 'STRING',
    })
    return
  }

  if (Array.isArray(node)) {
    if (node.length > 0) {
      traverse(node[0], `${currentPath}[0]`, results, depth + 1)
    }
    return
  }

  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      traverse(value, `${currentPath}.${key}`, results, depth + 1)
    }
    return
  }

  // Leaf value
  results.push({
    jsonPath: currentPath,
    fieldName: extractFieldName(currentPath),
    sampleValue: node,
    inferredType: inferType(node),
  })
}

function extractFieldName(path: string): string {
  const parts = path.split('.')
  const last = parts[parts.length - 1]
  // Remove array index suffix like [0]
  return last.replace(/\[\d+\]$/, '')
}

function inferType(value: unknown): string {
  if (typeof value === 'boolean') return 'BOOLEAN'
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'LONG' : 'DOUBLE'
  }
  return 'STRING'
}