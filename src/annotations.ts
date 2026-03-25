import * as vscode from "vscode";

export interface AnnotationTarget {
  filePath: string;
  lineRange: [number, number];
  exact: string;
}

export interface Annotation {
  id: string;
  target: AnnotationTarget;
  body: string;
  createdAt: number;
}

export class AnnotationStore {
  private annotations: Annotation[] = [];
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  add(target: AnnotationTarget, body: string): Annotation {
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      target,
      body,
      createdAt: Date.now(),
    };
    this.annotations.push(annotation);
    this._onDidChange.fire();
    return annotation;
  }

  remove(id: string): void {
    this.annotations = this.annotations.filter((a) => a.id !== id);
    this._onDidChange.fire();
  }

  update(id: string, body: string): void {
    const annotation = this.annotations.find((a) => a.id === id);
    if (annotation) {
      annotation.body = body;
      this._onDidChange.fire();
    }
  }

  getAll(): Annotation[] {
    return [...this.annotations];
  }

  getByFile(filePath: string): Annotation[] {
    return this.annotations.filter((a) => a.target.filePath === filePath);
  }

  clear(): void {
    this.annotations = [];
    this._onDidChange.fire();
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}

export function formatAnnotation(a: Annotation): string {
  const [start, end] = a.target.lineRange;
  const loc = start === end ? `L${start}` : `L${start}-L${end}`;
  let quote = a.target.exact.trim();
  if (quote.length > 200) {
    quote = quote.slice(0, 197) + "...";
  }
  const quoted = quote.split("\n").map((l) => `> ${l}`).join("\n");
  return `[${a.target.filePath}:${loc}]\n${quoted}\n${a.body}`;
}

export function formatAllAnnotations(annotations: Annotation[]): string {
  return annotations.map(formatAnnotation).join("\n\n");
}
