
export interface Point3D {
  id: string;
  x: number;
  y: number;
  z: number;
  label?: string;
}

export interface LineSegment {
  sourceId: string;
  targetId: string;
  style: 'solid' | 'dashed';
  color?: string;
}

export interface GeometryScene {
  points: Point3D[];
  segments: LineSegment[];
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isThinking?: boolean;
}

export interface GeminiResponse {
  explanation: string;
  geometry?: GeometryScene;
}

export interface SavedSession {
  id: string;
  name: string;
  date: number;
  messages: Message[];
  scene: GeometryScene;
}
