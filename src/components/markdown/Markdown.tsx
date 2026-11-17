// Markdown ответов чата и документов базы знаний. Файл грузится только вместе с чатом и страницей базы знаний:
// react-markdown и remark-gfm не должны попадать в первую загрузку дашбордов.
import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const plugins = [remarkGfm];

/** Изображения не переносятся из документов, и в ответах их тоже не показываем. */
const DISALLOWED = ['img'];

/** react-markdown передаёт в компоненты узел дерева (node): в DOM он не нужен и не должен попадать в атрибуты. */
function withoutNode<P extends { node?: unknown }>(props: P): Omit<P, 'node'> {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

const components: Components = {
  // Ссылка уводит из чата — открываем в новой вкладке, чтобы диалог не потерялся
  a: (props) => <a {...withoutNode(props)} target="_blank" rel="noopener noreferrer" />,
  // Широкая таблица в узкой панели прокручивается сама, а не растягивает панель
  table: (props) => (
    <div className="kb-md-table">
      <table {...withoutNode(props)} />
    </div>
  ),
};

export const Markdown = memo(function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className ? `kb-md ${className}` : 'kb-md'}>
      <ReactMarkdown remarkPlugins={plugins} components={components} disallowedElements={DISALLOWED} skipHtml>
        {children}
      </ReactMarkdown>
    </div>
  );
});
