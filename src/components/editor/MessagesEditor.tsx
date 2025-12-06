import { useEffect, useState } from "react";
import type { PetalflyDocument } from "@/types/pfs";

export function MessagesEditor({
  doc,
  updateDocument,
}: {
  doc: PetalflyDocument;
  updateDocument: (doc: PetalflyDocument) => void;
}) {
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (doc.request.body?.value) {
      try {
        const parsed = JSON.parse(doc.request.body.value);
        setMessages(Array.isArray(parsed) ? parsed : []);
      } catch {
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  }, [doc.request.body?.value]);

  const updateMessages = (newMessages: any[]) => {
    setMessages(newMessages);
    updateDocument({
      ...doc,
      request: {
        ...doc.request,
        body: {
          type: "text",
          value: JSON.stringify(newMessages),
        },
      },
    });
  };

  const addMessage = () => {
    updateMessages([...messages, { message_type: "text", data: "" }]);
  };

  const updateMessage = (index: number, field: string, value: string) => {
    const newMessages = [...messages];
    newMessages[index] = { ...newMessages[index], [field]: value };
    updateMessages(newMessages);
  };

  const removeMessage = (index: number) => {
    const newMessages = messages.filter((_, i) => i !== index);
    updateMessages(newMessages);
  };

  return (
    <div className="messages-editor">
      <h4>Mensajes WebSocket</h4>
      <div className="messages-list">
        {messages.map((message: any, index: number) => (
          <div key={index} className="message-item">
            <select
              value={message.message_type}
              onChange={(e) => updateMessage(index, "message_type", e.target.value)}
            >
              <option value="text">Texto</option>
              <option value="binary">Binario</option>
            </select>
            <input
              value={message.data}
              onChange={(e) => updateMessage(index, "data", e.target.value)}
              placeholder="Contenido del mensaje"
            />
            <button onClick={() => removeMessage(index)}>✕</button>
          </div>
        ))}
      </div>
      <button onClick={addMessage} className="button--primary">Añadir mensaje</button>
    </div>
  );
}