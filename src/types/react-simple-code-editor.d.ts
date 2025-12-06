declare module "react-simple-code-editor" {
  import * as React from "react";

  export interface EditorProps {
    value: string;
    onValueChange: (code: string) => void;
    highlight: (code: string) => string;
    padding?: number;
    className?: string;
    textareaId?: string;
    style?: React.CSSProperties;
    tabSize?: number;
    insertSpaces?: boolean;
    autoFocus?: boolean;
    preClassName?: string;
    textareaClassName?: string;
    ignoreTabKey?: boolean;
  }

  export default function Editor(props: EditorProps): JSX.Element;
}
