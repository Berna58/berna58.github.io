import { useT } from '@/i18n/ui';
import { ProjectHeader, Gallery } from './ProjectParts';
import type { ProjectViewProps } from './types';

/** Estudo de caso: o mesmo componente gera a página pública e a pré-visualização do painel. */
export default function CaseStudy(props: ProjectViewProps) {
  const { locale, project, gallery } = props;
  const t = useT(locale);
  const text = project.i18n[locale];
  const summary = [
    { label: t('project.problem'), value: text.problem },
    { label: t('project.role'), value: text.role },
    { label: t('project.result'), value: text.results },
  ].filter((item) => item.value);

  return (
    <article className="pj">
      <ProjectHeader {...props} />

      {summary.length > 0 && (
        <section className="pj-tldr" aria-labelledby="pj-tldr">
          <h2 id="pj-tldr" className="visually-hidden">{t('project.summary30')}</h2>
          <dl>
            {summary.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{firstParagraph(item.value ?? '')}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {(text.problem || text.audience) && (
        <section className="pj-section" aria-labelledby="pj-problem">
          <h2 id="pj-problem">{t('project.problem')}</h2>
          {text.problem && <Prose text={text.problem} />}
          {text.audience && (
            <p className="pj-audience"><strong>{t('project.audience')}:</strong> {text.audience}</p>
          )}
        </section>
      )}

      {text.solution && (
        <section className="pj-section" aria-labelledby="pj-solution">
          <h2 id="pj-solution">{t('project.solution')}</h2>
          <Prose text={text.solution} />
        </section>
      )}

      {text.features.length > 0 && (
        <section className="pj-section" aria-labelledby="pj-features">
          <h2 id="pj-features">{t('project.features')}</h2>
          <ul className="pj-cards">
            {text.features.map((f) => (
              <li key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {text.decisions.length > 0 && (
        <section className="pj-section" aria-labelledby="pj-decisions">
          <h2 id="pj-decisions">{t('project.decisions')}</h2>
          <dl className="pj-pairs">
            {text.decisions.map((d) => (
              <div key={d.decision}>
                <dt>{d.decision}</dt>
                <dd><span className="pj-pair-label">{t('project.why')}</span> {d.reason}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {text.challenges.length > 0 && (
        <section className="pj-section" aria-labelledby="pj-challenges">
          <h2 id="pj-challenges">{t('project.challenges')}</h2>
          <dl className="pj-pairs">
            {text.challenges.map((c) => (
              <div key={c.challenge}>
                <dt>{c.challenge}</dt>
                <dd><span className="pj-pair-label">{t('project.how')}</span> {c.solution}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {text.results && (
        <section className="pj-section" aria-labelledby="pj-results">
          <h2 id="pj-results">{t('project.results')}</h2>
          <Prose text={text.results} />
        </section>
      )}

      {text.aiUsage && (
        <section className="pj-section" aria-labelledby="pj-ai">
          <h2 id="pj-ai">{t('project.ai')}</h2>
          <Prose text={text.aiUsage} />
        </section>
      )}

      <Gallery locale={locale} images={gallery} />
    </article>
  );
}

function Prose({ text }: { text: string }) {
  return (
    <div className="pj-prose">
      {text.split(/\n{2,}/).map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </div>
  );
}

const firstParagraph = (value: string) => value.split(/\n{2,}/)[0];
