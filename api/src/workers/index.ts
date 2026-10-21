import { readConfig } from '../config/env'
import { createServices } from '../config/services'
import { Worker } from './runner'
import { log } from '../security/log'
const services = createServices(readConfig()),worker = new Worker(services.db,services.config,services.store,services.provider,services.metrics,services.editingProvider)
const controller = new AbortController()
const stop = () => { worker.stop(); controller.abort() }
process.on('SIGINT',stop)
process.on('SIGTERM',stop)
log('worker.started',{ workerId:worker.id })
try { await worker.run(controller.signal) }
finally { services.limits.close(); await services.db.close({ timeout:5 }); log('worker.stopped') }
