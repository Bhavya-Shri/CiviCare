import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div>
      <section className="hero">
        <div>
          <p className="eyebrow">Chennai academic prototype</p>
          <h1>Community Emergency Readiness & Response</h1>
          <p className="tagline">Prepared communities. Coordinated care.</p>
          <p className="lede">
            CiviCare keeps a structured record of who is eligible to help, then compares a nearest-responder rule with one that also protects thin neighbourhood coverage. Official emergency services stay first.
          </p>
        </div>
        <aside className="card">
          <h2>Call 112 first</h2>
          <p>If someone needs urgent help, use the phone. CiviCare does not send an ambulance and does not confirm that a person is on the way.</p>
          <a className="call-112" href="tel:112">Call 112</a>
        </aside>
      </section>
      <section className="grid two">
        <Link className="card choice" to="/report" state={{ reporterRole: 'self' }}>
          <strong>I need help</strong>
          <span>Report for yourself with a category and a location. No account required.</span>
        </Link>
        <Link className="card choice" to="/report" state={{ reporterRole: 'bystander' }}>
          <strong>I am helping someone</strong>
          <span>Report as a bystander. Do not enter their name or a medical history.</span>
        </Link>
      </section>
      <section className="grid three" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Eligibility before distance</h3>
          <p>Expired certificates, stale availability, and an existing simulated assignment remove a person before either rule can choose them.</p>
        </article>
        <article className="card">
          <h3>Coverage has a cost</h3>
          <p>The second rule may pick someone a little farther when the closest person is the last cover for their zone. The extra distance is shown, not hidden.</p>
        </article>
        <article className="card">
          <h3>Simulated on purpose</h3>
          <p>Responders in this build are fictional ids. Facility pins are approximate samples, not a live bed board.</p>
        </article>
      </section>
    </div>
  )
}
