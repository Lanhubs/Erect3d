import type { Project } from '../../domain/types'
import { LandingDemo } from './LandingDemo'
import { ComparisonPreview } from './ComparisonPreview'
import { CustomizationFeature } from './CustomizationFeature'
import { ArchitecturalViewsPreview, WalkthroughPreview } from './LandingExperiencePreviews'

type LandingPageProps = {
  projects: Project[]
  onStartDesigning: () => void
  onOpenWorkspace: () => void
}

const workflow = [
  {
    number: '01',
    title: 'Draw or import',
    text: 'Start with a blank canvas or bring in an existing floor plan.',
  },
  {
    number: '02',
    title: 'Edit the building',
    text: 'Define walls, doors, windows, floors, roofing and other architectural elements.',
  },
  {
    number: '03',
    title: 'Build in 3D',
    text: 'The same architectural model becomes a complete three-dimensional building.',
  },
  {
    number: '04',
    title: 'Step inside',
    text: 'Explore the result in first-person or inspect it from architectural views.',
  },
]

export function LandingPage({ projects, onStartDesigning, onOpenWorkspace }: LandingPageProps) {
  const hasProjects = projects.length > 0

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-brand" aria-label="Erect3D home">
          <div className="brand-mark"><img src="/favicon.svg" alt="Erect3D logo" /></div>
          <span className="brand-word">ERECT3D</span>
        </div>

        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#capabilities">Capabilities</a>
        </nav>

        <div className="landing-actions">
          {hasProjects && <button type="button" className="button button-secondary" onClick={onOpenWorkspace}>Open Workspace</button>}
          <button type="button" className="button button-primary" onClick={onStartDesigning}>Start Designing</button>
        </div>
      </header>

      <main className="landing-main">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">BROWSER-BASED ARCHITECTURAL DESIGN</p>
            <h1>
              <span>Design in 2D.</span>
              <span>Experience it in 3D.</span>
            </h1>
            <p className="hero-text">
              Create a floor plan from scratch or import an existing one, shape the building in 2D,
              customize its structure and materials, then step inside the result directly from your browser.
            </p>

            <div className="hero-actions">
              <button type="button" className="button button-primary" onClick={onStartDesigning}>Start Designing</button>
              <a href="#how-it-works" className="button button-link">See How It Works</a>
            </div>
          </div>

          <div className="hero-visual" aria-label="Erect3D plan to model workflow">
            <LandingDemo />
          </div>
        </section>

        <section className="product-statement" id="product">
          <p className="eyebrow">MORE THAN A FLOOR-PLAN CONVERTER</p>
          <h2>
            Create or import floor plans, then edit and experience them as interactive 3D buildings in a
            browser-based architectural workspace.
          </h2>
        </section>

        <section className="process-section" id="how-it-works">
          <div className="section-heading">
            <p className="eyebrow">HOW IT WORKS</p>
            <h3>From floor plan to explorable building.</h3>
          </div>

          <div className="process-grid">
            {workflow.map(step => (
              <article className="process-card" key={step.number}>
                <div className="process-number">{step.number}</div>
                <h4>{step.title}</h4>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="comparison-section" aria-labelledby="comparison-heading">
          <div className="section-heading narrow">
            <p className="eyebrow">ONE BUILDING. TWO WAYS TO WORK.</p>
            <h3 id="comparison-heading">The plan and the model remain connected.</h3>
          </div>

          <ComparisonPreview />

          <p className="comparison-copy">
            Changes made to the plan are reflected in the building model, allowing users to move between
            architectural planning and spatial visualization without rebuilding the project from scratch.
          </p>
        </section>

        <section className="starting-section" id="capabilities">
          <div className="section-heading">
            <p className="eyebrow">CREATE OR IMPORT</p>
            <h3>Choose the starting point that matches the project.</h3>
          </div>

          <div className="starting-grid">
            <article className="starting-card">
              <div className="starting-topline">CREATE</div>
              <h4>Start from a blank canvas.</h4>
              <p>Draw the plan directly in the browser and shape the building as you refine the architecture.</p>
            </article>

            <article className="starting-card">
              <div className="starting-topline">IMPORT</div>
              <h4>Bring in an existing drawing.</h4>
              <p>Prepare the source scale, reconstruct the plan and continue editing without leaving the workspace.</p>
            </article>
          </div>
        </section>

        <CustomizationFeature />

        <section className="materials-section">
          <div className="section-heading narrow">
            <p className="eyebrow">FLOOR MATERIALS</p>
            <h3>Structure and finish are part of the design.</h3>
          </div>

          <div className="material-grid">
            <article className="material-card">
              <div className="material-row">
                <span>Structure</span>
                <strong>Reinforced Concrete</strong>
              </div>
              <div className="material-row">
                <span>Finish</span>
                <strong>Porcelain Tile</strong>
              </div>
            </article>

            <article className="material-card alt">
              <div className="material-row">
                <span>Structure</span>
                <strong>Reinforced Concrete</strong>
              </div>
              <div className="material-row">
                <span>Finish</span>
                <strong>Timber</strong>
              </div>
            </article>
          </div>
        </section>

        <section className="walkthrough-section">
          <div className="walkthrough-copy">
            <p className="eyebrow">DON’T JUST VIEW THE BUILDING.</p>
            <h3>Enter it.</h3>
            <p>
              Switch from architectural editing to a first-person walkthrough and experience the building at
              human scale directly from your computer.
            </p>
            <div className="controls-row">
              <span>W A S D</span>
              <span>Move</span>
              <span>Mouse</span>
              <span>Look</span>
            </div>
          </div>

          <WalkthroughPreview />
        </section>

        <section className="views-section">
          <div className="section-heading narrow">
            <p className="eyebrow">ARCHITECTURAL VIEWS</p>
            <h3>Understand the building from the right perspective.</h3>
          </div>

          <ArchitecturalViewsPreview />
        </section>

        <section className="browser-section">
          <div className="section-heading narrow">
            <p className="eyebrow">ARCHITECTURE IN THE BROWSER</p>
            <h3>Design, edit and explore buildings without a desktop-only workflow.</h3>
          </div>
          <p>
            Erect3D runs inside the browser, so the plan, model and walkthrough all live in the same working
            environment instead of depending on separate desktop tools.
          </p>
        </section>

        <section className="presentation-section">
          <div className="presentation-copy">
            <p className="eyebrow">FROM WORKSPACE TO PRESENTATION</p>
            <h3>Move from editing to a clean presentation view.</h3>
            <p>Switch into a presentation environment for exploring the completed design without editor clutter.</p>
          </div>
          <button type="button" className="button button-primary" onClick={onOpenWorkspace}>Open Workspace</button>
        </section>

        <section className="final-cta">
          <p className="eyebrow">YOUR NEXT BUILDING CAN START WITH A LINE.</p>
          <h3>Create the plan. Shape the architecture. Step inside.</h3>
          <button type="button" className="button button-primary" onClick={onStartDesigning}>Start Designing</button>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-brand brand-footer">
          <div className="brand-mark"><img src="/favicon.svg" alt="Erect3D logo" /></div>
          <span className="brand-word">ERECT3D</span>
        </div>
        <p>Browser-based architectural design and visualization.</p>
        <nav className="footer-nav" aria-label="Footer navigation">
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#capabilities">Capabilities</a>
        </nav>
      </footer>
    </div>
  )
}
