import Link from 'next/link';

export default function OverviewPage() {
  return (
    <div>
      <h1>Monitoring Overview</h1>
      <p>Select a section from the navigation above.</p>
      <nav>
        <ul>
          <li><Link href="/services">Services</Link> — <Link href="/services?tab=alarms" style={{ fontSize: '0.9em' }}>Alarms</Link></li>
          <li><Link href="/traces">Traces</Link></li>
        </ul>
      </nav>
    </div>
  );
}
