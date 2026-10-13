import { useT, type UiKey } from '@/i18n/ui';
import type { ProjectViewProps, ResolvedImage } from './types';

export function Img({ image, eager = false, className }: { image: ResolvedImage; eager?: boolean; className?: string }) {
  return (
    <img
      className={className}
      src={image.src}
      srcSet={image.srcSet}
      sizes={image.sizes}
      width={image.width}
      height={image.height}
      alt={image.alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}

/** Cabeçalho comum aos dois templates: título, frase, metadados, stack e ligações. */
export function ProjectHeader({ locale, project, categoryLabel, cover }: ProjectViewProps) {
  const t = useT(locale);
  const text = project.i18n[locale];
  const meta: [string, string][] = [[t('project.category'), categoryLabel]];
  if (project.year) meta.push([t('project.year'), String(project.year)]);
  if (project.state) meta.push([t('project.state'), t(('state.' + project.state) as UiKey) as string]);
  const isCase = project.kind === 'case_study';

  return (
    <header className="pj-header">
      <div className="pj-intro">
        <h1>{text.title}</h1>
        <p className="pj-summary">{text.summary}</p>
        <dl className="pj-meta">
          {meta.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {project.technologies.length > 0 && (
          <ul className="pj-tags" aria-label="Stack">
            {project.technologies.map((tech) => (
              <li className="tag" key={tech}>{tech}</li>
            ))}
          </ul>
        )}
        <div className="pj-links">
          {project.demoUrl && (
            <a className="btn btn--primary" href={project.demoUrl} rel="noopener" target="_blank">
              {t('project.demo')}
            </a>
          )}
          {project.repoUrl && (
            <a className="btn" href={project.repoUrl} rel="noopener" target="_blank">
              {t('project.code')}
            </a>
          )}
          {project.videoUrl && (
            <a className="btn" href={project.videoUrl} rel="noopener" target="_blank">
              {t('project.video')}
            </a>
          )}
          {isCase && !project.repoUrl && <span className="tag">{t(('code.' + project.codeVisibility) as UiKey)}</span>}
        </div>
      </div>
      <figure className="pj-cover">
        <Img image={cover} eager />
      </figure>
    </header>
  );
}

export function Gallery({ locale, images }: { locale: ProjectViewProps['locale']; images: ResolvedImage[] }) {
  const t = useT(locale);
  if (images.length === 0) return null;
  return (
    <section className="pj-section" aria-labelledby="pj-gallery">
      <h2 id="pj-gallery">{t('project.gallery')}</h2>
      <div className="pj-gallery">
        {images.map((image) => (
          <figure key={image.src}>
            <Img image={image} />
            {image.caption && <figcaption>{image.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  );
}
