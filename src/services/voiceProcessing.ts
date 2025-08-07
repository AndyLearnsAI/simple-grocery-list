export interface ProcessedItem {
  item: string;
  quantity: number;
  notes?: string;
  confidence: number;
}

export interface VoiceProcessingResponse {
  items: ProcessedItem[];
  success: boolean;
  error?: string;
}

export async function processVoiceItems(transcript: string): Promise<VoiceProcessingResponse> {
  try {
    const response = await fetch('/api/process-voice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Voice processing error:', error);
    return {
      items: [],
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process voice input'
    };
  }
}

export function formatItemsForDisplay(items: ProcessedItem[]): string {
  if (items.length === 0) {
    return 'No items detected. Please try speaking more clearly.';
  }

  return items.map(item => 
    `• ${item.quantity}x ${item.item}${item.notes ? ` (${item.notes})` : ''}`
  ).join('\n');
}

export function validateProcessedItems(items: ProcessedItem[]): { valid: boolean; error?: string } {
  if (items.length === 0) {
    return { valid: false, error: 'No items were detected in your voice input.' };
  }

  for (const item of items) {
    if (!item.item.trim()) {
      return { valid: false, error: 'Some items have empty names.' };
    }
    if (item.quantity <= 0) {
      return { valid: false, error: 'Some items have invalid quantities.' };
    }
  }

  return { valid: true };
} 