import React from 'react';
import PageHeader from '../components/PageHeader';
import { Layers, ArrowRight, Database, CheckCircle2 } from 'lucide-react';

export default function PlaceholderPage({
  title,
  stage = 'Stage 2',
  description,
  workflowStep,
  entities = [],
  nextMilestone,
}) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <span className="placeholder-badge">
            PLANNED FOR {stage.toUpperCase()}
          </span>
        }
      />

      <div className="placeholder-banner">
        <div style={{ color: 'var(--solar-green-600)', marginTop: '2px' }}>
          <Layers size={28} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy-900)' }}>
            Module Scaffolded · Database Model Initialized
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--navy-700)', marginTop: '0.25rem', lineHeight: 1.5 }}>
            This operational module is part of the SunPower Solutions 5-stage roadmap. Its foundational database schema, foreign keys, and relationships have been built and verified in SQLite.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--navy-900)', fontWeight: 700 }}>
            <ArrowRight size={18} color="var(--solar-green-500)" />
            <span>Workflow Position</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            {workflowStep || 'Core operational milestone within the EPC pipeline.'}
          </p>
          <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid var(--border-subtle)' }}>
            <strong>Target Delivery:</strong> {stage} ({nextMilestone || 'Workflow & interactive controllers'})
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--navy-900)', fontWeight: 700 }}>
            <Database size={18} color="var(--amber-500)" />
            <span>Active Relational Entities</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Tables already mapped and seeded in SQLite:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {entities.map((ent, idx) => (
              <span key={idx} className="workflow-pill">
                <CheckCircle2 size={13} color="var(--solar-green-500)" />
                <code>{ent}</code>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

