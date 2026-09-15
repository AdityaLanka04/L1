import { repairMermaidSyntax } from '../../utils/mermaidSyntax';

test('repairs the production nuclear diagram without changing its relationships', () => {
  expect(repairMermaidSyntax('flowchart TD\nB -->|Made of| C[Protons (+)]\nB --> D[Neutrons (neutral)]'))
    .toBe('flowchart TD\nB -->|Made of| C["Protons (+)"]\nB --> D["Neutrons (neutral)"]');
});
test('preserves quoted labels and does not invent missing targets', () => {
  const source = 'flowchart TD\nA["Energy (MeV)"] -->|release|';
  expect(repairMermaidSyntax(source)).toBe(source);
});
test('preserves non-flowchart languages and compound shapes', () => {
  for (const source of ['sequenceDiagram\nA->>B: f(x)', 'flowchart TD\nA[[Function (x)]]', 'flowchart TD\nA[/Input (x)/]']) {
    expect(repairMermaidSyntax(source)).toBe(source);
  }
});
