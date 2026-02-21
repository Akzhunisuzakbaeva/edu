declare module "react-contenteditable" {
    import * as React from "react";
  
    export interface ContentEditableEvent<T = HTMLElement> extends React.SyntheticEvent<T> {
      target: T & { value: string; };
    }
  
    export interface Props<T = HTMLElement> extends React.HTMLAttributes<T> {
      html: string;
      disabled?: boolean;
      tagName?: keyof JSX.IntrinsicElements;
      onChange?: (evt: ContentEditableEvent<T>) => void;
      innerRef?: React.Ref<T>;
    }
  
    export default class ContentEditable<T = HTMLElement> extends React.Component<Props<T>> {}
  }
  