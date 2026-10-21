import type { Hono } from 'hono'
import type { ApiEnv } from './middleware/types'
import type { Services } from './config/services'
import { authRoutes } from './modules/auth/routes'
import { userRoutes } from './modules/users/routes'
import { teamRoutes } from './modules/teams/routes'
import { projectRoutes } from './modules/projects/routes'
import { collaborationRoutes } from './modules/collaboration/routes'
import { versionRoutes } from './modules/versions/routes'
import { assetRoutes } from './modules/assets/routes'
import { optimizedUploadRoutes } from './modules/assets/optimized-upload'
import { sourceRoutes } from './modules/assets/sources'
import { commentRoutes } from './modules/comments/routes'
import { issueRoutes } from './modules/issues/routes'
import { approvalRoutes } from './modules/approvals/routes'
import { analysisRoutes } from './modules/plan-analysis/routes'
import { presentationRoutes } from './modules/presentations/routes'
import { shareRoutes } from './modules/shares/routes'
import { publicShareRoutes } from './modules/shares/public'
import { libraryRoutes } from './modules/components/routes'
import { exportRoutes } from './modules/exports/routes'
import { auditRoutes } from './modules/audit/routes'
import { realtimeRoutes } from './realtime/routes'
import { sessionGuard } from './middleware/auth'
import { memberTraffic } from './middleware/traffic'
import { templateRoutes } from './modules/templates/routes'
import {assistantRoutes} from './modules/assistant/routes'
export function mountRoutes(app:Hono<ApiEnv>,services:Services) {
  const { db,config,limits,store,hub } = services
  app.route('/api/v1/auth',authRoutes(db,config,limits))
  app.route('/api/v1/public/shares',publicShareRoutes(db,limits))
  app.use('/api/v1/*',sessionGuard(db,config))
  app.use('/api/v1/*',memberTraffic(limits))
  app.route('/api/v1/users',userRoutes(db))
  app.route('/api/v1/teams',teamRoutes(db))
  app.route('/api/v1/projects',projectRoutes(db,config))
  app.route('/api/v1/projects',assistantRoutes(services))
  app.route('/api/v1/templates',templateRoutes(db,config))
  app.route('/api/v1/projects',collaborationRoutes(db))
  app.route('/api/v1/projects',versionRoutes(db,config.MAX_PROJECT_BYTES))
  app.route('/api/v1/projects',assetRoutes(db,config,store))
  app.route('/api/v1/projects',optimizedUploadRoutes(db,config,store))
  app.route('/api/v1/projects',sourceRoutes(db))
  app.route('/api/v1/projects',commentRoutes(db))
  app.route('/api/v1/projects',issueRoutes(db))
  app.route('/api/v1/projects',approvalRoutes(db))
  app.route('/api/v1',analysisRoutes(db,config,id=>services.requestedAnalysis?.start(id)))
  app.route('/api/v1/projects',presentationRoutes(db))
  app.route('/api/v1/projects',shareRoutes(db))
  app.route('/api/v1/library',libraryRoutes(db))
  app.route('/api/v1/projects',exportRoutes(db,store))
  app.route('/api/v1/projects',auditRoutes(db))
  app.route('/api/v1/realtime',realtimeRoutes(hub,limits))
}
