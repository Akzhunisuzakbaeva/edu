export type ObjType = "text" | "image" | "sticker";

export interface SlideObject {
  id: string;
  type: ObjType;
  x: number; y: number; w: number; h: number;
  r?: number;           // rotation
  text?: string;        // for text
  src?: string;         // for image
  sticker?: string;     // for sticker/emoji
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
}
