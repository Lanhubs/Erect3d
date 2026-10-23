import type { Hono } from 'hono'
import { z } from 'zod'
import type { ApiEnv } from '../middleware/types'
import { projectSchema } from './project'
import { operationSchema } from './operations'
import { analysisRequest, intelligenceSchema } from './analysis'
import { commentSchema, issueSchema, approvalSchema, presentationSchema, savedViewSchema } from './review'
import { librarySchema } from '../modules/components/routes'
import { shareSchema } from '../modules/shares/routes'
import { sourceLinkSchema } from '../modules/assets/sources'
import { guestCommentSchema, guestApprovalSchema } from '../modules/shares/public'
import { createProjectSchema } from '../modules/projects/routes'
import { credentials, registration } from '../modules/auth/routes'
const contracts: Record<string, z.ZodType> = {
  Project: projectSchema,
  Operation: operationSchema,
  AnalysisRequest: analysisRequest,
  Intelligence: intelligenceSchema,
  Comment: commentSchema,
  Issue: issueSchema,
  Approval: approvalSchema,
  Presentation: presentationSchema,
  SavedView: savedViewSchema,
  LibraryItem: librarySchema,
  Share: shareSchema,
  SourceLink: sourceLinkSchema,
  GuestComment: guestCommentSchema,
  GuestApproval: guestApprovalSchema,
  CreateProject: createProjectSchema,
  Login: credentials,
  Registration: registration,
}
const requestContracts: Record<string, string> = {
  operations: 'Operation',
  analysis: 'AnalysisRequest',
  comments: 'Comment',
  issues: 'Issue',
  approvals: 'Approval',
  presentations: 'Presentation',
  views: 'SavedView',
  shares: 'Share',
  library: 'LibraryItem',
}
export function buildOpenApi(app: Hono<ApiEnv>, cookieName = 'erect_session') {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const route of app.routes) {
    if (route.method === 'ALL' || route.path.includes('*')) continue
    const path = route.path.replace(/:([a-zA-Z]+)/g, '{$1}'),
      parameters = [...route.path.matchAll(/:([a-zA-Z]+)/g)].map((match) => ({
        name: match[1],
        in: 'path',
        required: true,
        schema: { type: 'string', maxLength: 128 },
      }))
    const suffix = route.path.split('/').at(-1)!,
      publicShare = route.path.includes('/public/')
    const special: Record<string, string> = {
      '/api/v1/projects': 'CreateProject',
      '/api/v1/auth/login': 'Login',
      '/api/v1/auth/register': 'Registration',
    }
    const component =
      route.method === 'POST'
        ? publicShare
          ? { comments: 'GuestComment', approvals: 'GuestApproval' }[suffix as 'comments' | 'approvals']
          : special[route.path.replace(/\/$/, '')] || requestContracts[suffix]
        : undefined
    const anonymous =
      publicShare || ['/health', '/ready', '/api/v1/auth/login', '/api/v1/auth/register'].includes(path)
    if (!anonymous && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.method)) {
      parameters.push({
        name: 'X-CSRF-Token',
        in: 'header',
        required: true,
        schema: { type: 'string', maxLength: 128 },
      })
    }
    paths[path] ||= {}
    paths[path][route.method.toLowerCase()] = {
      operationId: `${route.method.toLowerCase()}_${route.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
      parameters,
      security: anonymous ? [] : [{ sessionCookie: [] }],
      ...(component
        ? {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: { $ref: `#/components/schemas/${component}` } } },
            },
          }
        : {}),
      responses: {
        '200': { description: 'Success; creation, asynchronous work and deletions may use 201, 202 or 204.' },
        '4XX': {
          description: 'Validated request, authorization or conflict failure',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
        },
        '5XX': { description: 'Dependency unavailable or internal failure' },
      },
    }
  }
  return {
    openapi: '3.1.0',
    info: { title: 'Erect3D API', version: '1.0.0' },
    paths,
    components: {
      securitySchemes: { sessionCookie: { type: 'apiKey', in: 'cookie', name: cookieName } },
      schemas: {
        ...Object.fromEntries(
          Object.entries(contracts).map(([name, schema]) => [name, componentSchema(name, schema)]),
        ),
        ApiError: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message', 'requestId'],
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                requestId: { type: 'string' },
                details: {},
              },
            },
          },
        },
      },
    },
  }
}
function componentSchema(name: string, schema: z.ZodType) {
  // Recursive JSON values need references rooted at their component, not at the entire OpenAPI document.
  const output = z.toJSONSchema(schema, { io: 'input' })
  return JSON.parse(
    JSON.stringify(output).replaceAll('"$ref":"#/$defs/', '"$ref":"#/components/schemas/' + name + '/$defs/'),
  )
}
