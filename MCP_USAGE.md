# AI Wiki MCP Tools Usage Guide

This document explains how to use the AI Wiki MCP tools for contributing and reading documentation.

## Available Tools

### 1. `upload`
Upload a file to the AI wiki storage and get a file ID.

**Parameters:**
- `fileName` (string): The name of the file (e.g., "shadcn-guide.md")
- `content` (string): The file content as a string
- `contentType` (string, optional): MIME type (default: "text/plain")

**Returns:** File ID that can be used with the contribute tool

**Example:**
```json
{
  "fileName": "shadcn-installation.md",
  "content": "# Shadcn Installation Guide\n\nFollow these steps...",
  "contentType": "text/markdown"
}
```

### 2. `contribute`
Map an uploaded file to a route path in the wiki.

**Parameters:**
- `fileId` (string): The file ID from the upload tool
- `route` (string): The route path (e.g., "ui/shadcn/installation")
- `fileName` (string): The original file name for reference

**Returns:** Success message with the route mapping

**Example:**
```json
{
  "fileId": "abc-123-def-456",
  "route": "ui/shadcn/installation",
  "fileName": "shadcn-installation.md"
}
```

### 3. `read`
Read content by route path or search for content.

**Parameters:**
- `route` (string): Route path or search terms

**Returns:**
- If exact route found: Full file content
- If no exact match: Top 10 search results with snippets

**Example:**
```json
{
  "route": "ui/shadcn/installation"
}
```

## Workflow

### Contributing New Content

1. **Upload the file:**
   ```
   Tool: upload
   - fileName: "shadcn-guide.md"
   - content: "# Shadcn Guide\n\n..."
   ```

2. **Map to a route:**
   ```
   Tool: contribute
   - fileId: <from-upload-response>
   - route: "ui/shadcn/installation"
   - fileName: "shadcn-guide.md"
   ```

### Reading Content

1. **By exact route:**
   ```
   Tool: read
   - route: "ui/shadcn/installation"
   ```

2. **By search:**
   ```
   Tool: read
   - route: "shadcn components"
   ```
   Returns top 10 matching routes with snippets.

## MCP Endpoint

The MCP server is available at: `/api/mcp`

## Route Structure

Routes are hierarchical paths like file systems:
- `ui/shadcn/installation`
- `ui/shadcn/components`
- `backend/supabase/auth`
- `backend/nodejs/express`

This structure allows for organized documentation that AI agents can easily navigate and search.
