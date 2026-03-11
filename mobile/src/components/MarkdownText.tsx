import { Text, View, StyleSheet } from 'react-native';

const GOLD_L  = '#FFE8A0';
const GOLD_M  = '#C9A87C';
const GOLD_D  = '#7A5C2E';
const DIM     = '#5A5040';
const BORDER  = '#1E1E1E';
const CODE_BG = '#0F0F0F';

interface Props { children: string; }

// Split text into inline segments: bold, italic, inline code, plain
function parseInline(text: string): JSX.Element[] {
  const parts: JSX.Element[] = [];
  // Pattern: **bold**, *italic*, `code`
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(<Text key={key++} style={s.plain}>{text.slice(last, m.index)}</Text>);
    }
    if (m[2] !== undefined) {
      parts.push(<Text key={key++} style={s.bold}>{m[2]}</Text>);
    } else if (m[3] !== undefined) {
      parts.push(<Text key={key++} style={s.italic}>{m[3]}</Text>);
    } else if (m[4] !== undefined) {
      parts.push(<Text key={key++} style={s.inlineCode}>{m[4]}</Text>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push(<Text key={key++} style={s.plain}>{text.slice(last)}</Text>);
  }
  return parts.length > 0 ? parts : [<Text key={0} style={s.plain}>{text}</Text>];
}

export default function MarkdownText({ children }: Props) {
  const raw = children ?? '';

  // Pre-process LaTeX: $$...$$ → code block, $...$ → inline code
  const text = raw
    .replace(/\$\$([^$]+)\$\$/g, (_, eq) => '\n```\n' + eq.trim() + '\n```\n')
    .replace(/\$([^$\n]+)\$/g, (_, eq) => '`' + eq.trim() + '`');

  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block fence
    if (line.trim() === '```' || line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '```') {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <View key={key++} style={s.codeBlock}>
          <Text style={s.codeText}>{codeLines.join('\n')}</Text>
        </View>
      );
      i++;
      continue;
    }

    // H1
    if (line.startsWith('# ')) {
      elements.push(<Text key={key++} style={s.h1}>{line.slice(2)}</Text>);
      i++; continue;
    }
    // H2
    if (line.startsWith('## ')) {
      elements.push(<Text key={key++} style={s.h2}>{line.slice(3)}</Text>);
      i++; continue;
    }
    // H3
    if (line.startsWith('### ')) {
      elements.push(<Text key={key++} style={s.h3}>{line.slice(4)}</Text>);
      i++; continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<View key={key++} style={s.hr} />);
      i++; continue;
    }

    // Bullet list
    if (line.match(/^[-*] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <View key={key++} style={s.list}>
          {items.map((item, idx) => (
            <View key={idx} style={s.listRow}>
              <Text style={s.bullet}>•</Text>
              <Text style={s.listText}>{parseInline(item)}</Text>
            </View>
          ))}
        </View>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\. /)) {
      const items: { n: string; t: string }[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        const m = lines[i].match(/^(\d+)\. (.+)/);
        if (m) items.push({ n: m[1], t: m[2] });
        i++;
      }
      elements.push(
        <View key={key++} style={s.list}>
          {items.map((item, idx) => (
            <View key={idx} style={s.listRow}>
              <Text style={s.bullet}>{item.n}.</Text>
              <Text style={s.listText}>{parseInline(item.t)}</Text>
            </View>
          ))}
        </View>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <View key={key++} style={s.blockquote}>
          <Text style={s.blockquoteText}>{parseInline(line.slice(2))}</Text>
        </View>
      );
      i++; continue;
    }

    // Empty line → spacer
    if (line.trim() === '') {
      elements.push(<View key={key++} style={{ height: 6 }} />);
      i++; continue;
    }

    // Normal paragraph
    elements.push(
      <Text key={key++} style={s.para}>{parseInline(line)}</Text>
    );
    i++;
  }

  return <View>{elements}</View>;
}

const s = StyleSheet.create({
  plain:      { color: GOLD_L, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22 },
  bold:       { color: GOLD_L, fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 22 },
  italic:     { color: GOLD_M, fontFamily: 'Inter_400Regular', fontStyle: 'italic', fontSize: 14, lineHeight: 22 },
  inlineCode: { color: '#FFD580', backgroundColor: '#1A1500', fontFamily: 'Inter_400Regular', fontSize: 13 },

  para: { color: GOLD_L, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22, marginBottom: 2 },

  h1: { color: GOLD_L, fontFamily: 'Inter_900Black', fontSize: 19, lineHeight: 26, marginTop: 10, marginBottom: 4 },
  h2: { color: GOLD_L, fontFamily: 'Inter_900Black', fontSize: 16, lineHeight: 24, marginTop: 8, marginBottom: 2 },
  h3: { color: GOLD_M, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 22, marginTop: 6, marginBottom: 2 },

  codeBlock: {
    backgroundColor: CODE_BG, borderRadius: 10, padding: 12,
    marginVertical: 6, borderWidth: 1, borderColor: BORDER,
  },
  codeText: { color: '#FFD580', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },

  hr: { height: 1, backgroundColor: BORDER, marginVertical: 8 },

  list:    { marginVertical: 4, gap: 4 },
  listRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bullet:  { color: GOLD_D, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 22, minWidth: 14 },
  listText:{ flex: 1, color: GOLD_L, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22 },

  blockquote: { borderLeftWidth: 3, borderLeftColor: GOLD_D, paddingLeft: 10, marginVertical: 4 },
  blockquoteText: { color: GOLD_M, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, fontStyle: 'italic' },
});
