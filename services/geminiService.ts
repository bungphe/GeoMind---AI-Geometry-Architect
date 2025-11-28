import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Message, GeometryScene } from "../types";

// Initialize Gemini Client
// We assume process.env.API_KEY is available as per instructions.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the Schema for the Geometry output to ensure strict JSON structure
const geometrySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    explanation: {
      type: Type.STRING,
      description: "A friendly explanation of the steps taken to construct the geometry or the answer to the user's question.",
    },
    geometry: {
      type: Type.OBJECT,
      description: "The 3D geometry data. Include this ONLY if the user asks to draw or modify a shape. Otherwise, leave it null.",
      nullable: true,
      properties: {
        points: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "Unique identifier for the point (e.g., 'A', 'S')" },
              x: { type: Type.NUMBER, description: "X coordinate" },
              y: { type: Type.NUMBER, description: "Y coordinate (Up/Down in 3D space usually corresponds to Y or Z depending on convention, here use Y as up)" },
              z: { type: Type.NUMBER, description: "Z coordinate" },
              label: { type: Type.STRING, description: "Label to display (e.g., 'A')" },
            },
            required: ["id", "x", "y", "z"],
          },
        },
        segments: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sourceId: { type: Type.STRING, description: "ID of the start point" },
              targetId: { type: Type.STRING, description: "ID of the end point" },
              style: { type: Type.STRING, enum: ["solid", "dashed"], description: "Use 'dashed' for hidden lines or internal structural lines, 'solid' for visible edges." },
            },
            required: ["sourceId", "targetId", "style"],
          },
        },
      },
      required: ["points", "segments"],
    },
  },
  required: ["explanation"],
};

export const sendMessageToGemini = async (
  history: Message[],
  currentPrompt: string,
  currentScene?: GeometryScene
): Promise<any> => {
  try {
    const model = "gemini-3-pro-preview";
    
    // Construct context from history and current scene state
    // We provide the current scene coordinates so the AI knows the current state of the geometry
    // This allows for incremental updates (e.g., "Add a point M on segment AB")
    let contextPrompt = "";
    if (currentScene && currentScene.points.length > 0) {
      contextPrompt += `\nCurrent Geometry State:\nPoints: ${JSON.stringify(currentScene.points)}\nSegments: ${JSON.stringify(currentScene.segments)}\n`;
    }
    
    contextPrompt += `
    You are GeoMind, an expert 3D Geometry Teacher.
    Your task is to help users visualize 3D geometry problems by calculating coordinates and defining shapes.
    
    COORDINATE SYSTEM CONVENTION:
    - Y-axis is vertical (UP).
    - X-axis and Z-axis form the horizontal plane.
    - Standard cube: (-1,-1,-1) to (1,1,1).
    - Pyramid example: Base on XZ plane, Apex high on Y axis.
    
    INSTRUCTIONS:
    1. Analyze the user's request.
    2. If they describe a shape, calculate the vertex coordinates carefully using your Thinking capabilities.
    3. Determine which lines should be solid (visible borders) and which should be dashed (hidden or internal).
    4. If modifying an existing shape, use the provided "Current Geometry State" as the baseline.
    5. Return the result in the specified JSON format.
    
    User Query: ${currentPrompt}
    `;

    // Convert internal message history to API format if needed, 
    // but for simplicity in this prompt-based flow, we just append the user's latest prompt.
    // In a real chat app, we might pass the full history object.
    
    const response = await ai.models.generateContent({
      model: model,
      contents: contextPrompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 }, // High budget for complex math reasoning
        responseMimeType: "application/json",
        responseSchema: geometrySchema,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response from Gemini");
    }

    try {
        return JSON.parse(responseText);
    } catch (e) {
        console.error("Failed to parse JSON", responseText);
        return { explanation: responseText, geometry: null };
    }

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};