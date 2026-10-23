import { readConfig } from '../src/config/env'
import { connect } from '../src/db/connection'
import { newId } from '../src/security/tokens'
import { ApiError } from '../src/security/errors'
import { saveSnapshot } from '../src/modules/projects/documents'
import { projectSchema } from '../src/contracts/project'
import { parse } from '../src/contracts/http'
const config = readConfig()
if (config.NODE_ENV === 'production')
  throw new ApiError(403, 'SEED_DISABLED', 'Development seed is disabled in production')
const email = process.env.SEED_EMAIL,
  password = process.env.SEED_PASSWORD
if (!email || !password || password.length < 12)
  throw new Error(
    'Supply SEED_EMAIL and SEED_PASSWORD (12 or more characters); no default credentials are created',
  )
const db = connect(config)
try {
  const hash = await Bun.password.hash(password, { algorithm: 'argon2id' }),
    userId = newId('user'),
    projectId = newId('project')
  const document = parse(projectSchema, {
    id: projectId,
    name: 'Cloud starter',
    modified: Date.now(),
    units: 'm',
    sources: [],
    buildings: [
      {
        id: newId('building'),
        name: 'Building',
        levels: [
          {
            id: newId('level'),
            name: 'Ground floor',
            elevation: 0,
            slabThickness: 0.2,
            walls: [],
            doors: [],
            windows: [],
            rooms: [],
          },
        ],
      },
    ],
  })
  await db.begin(async (tx) => {
    const [user] =
      await tx`INSERT INTO users(id,email,name,password_hash) VALUES (${userId},${email.toLowerCase()},'Developer',${hash})
      ON CONFLICT(email) DO NOTHING RETURNING id`
    if (!user) throw new Error('Seed account already exists; no password was changed')
    await tx`INSERT INTO projects(id,owner_id,name) VALUES (${projectId},${userId},${document.name})`
    await saveSnapshot(tx, projectId, 0, document)
  })
  console.log('Development account and starter project created')
} finally {
  await db.close()
}
