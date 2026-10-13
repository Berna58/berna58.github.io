import { ProjectHeader, Gallery } from './ProjectParts';
import type { ProjectViewProps } from './types';

/** Peça visual (design, sites sem estudo de caso): cabeçalho + galeria. */
export default function Showcase(props: ProjectViewProps) {
  return (
    <article className="pj pj--showcase">
      <ProjectHeader {...props} />
      <Gallery locale={props.locale} images={props.gallery} />
    </article>
  );
}
