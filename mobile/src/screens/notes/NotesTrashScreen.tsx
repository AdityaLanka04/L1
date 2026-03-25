import { NotesTrashScreen as SharedNotesTrashScreen, type NotesTrashProps } from './NotesShared';

export default function NotesTrashScreen(props: NotesTrashProps) {
  return <SharedNotesTrashScreen {...props} />;
}
