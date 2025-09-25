import React, { useState } from "react";

// Humanizador + AI-Detector - Single-file React component
// Usage: drop into a React app (e.g. Vite / Create React App). Tailwind classes are used
// but Tailwind is optional (styles included inline as fallback). This component does
// client-side calls to OpenAI's API. For production, put the API key in a server endpoint.

export default function HumanizerWithDetector() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [score, setScore] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("humanize"); // humanize | paraphrase
  const [tone, setTone] = useState("natural");
  const [temperature, setTemperature] = useState(0.7);
  const [apiKeyPrompted, setApiKeyPrompted] = useState(false);

  // Basic inline styles (keeps component usable even without Tailwind)
  const styles = {
    container: {
      maxWidth: 980,
      margin: "20px auto",
      padding: 18,
      fontFamily: "Inter, Arial, sans-serif",
    },
    textarea: {
      width: "100%",
      minHeight: 160,
      padding: 12,
      fontSize: 15,
      borderRadius: 8,
      border: "1px solid #ddd",
      resize: "vertical",
    },
    button: {
      padding: "10px 16px",
      marginRight: 8,
      borderRadius: 8,
      border: "none",
      cursor: "pointer",
    },
    output: {
      whiteSpace: "pre-wrap",
      background: "#fff",
      padding: 14,
      borderRadius: 8,
      border: "1px solid #ddd",
      minHeight: 120,
    },
  };

  // Prompt templates
  function buildHumanizePrompt(text) {
    return `Eres un experto en edición de textos. Reescribe el siguiente texto para que suene completamente humano, natural, fluido y con variedad léxica. Corrige errores gramaticales y de estilo, mejora la coherencia, pero mantén el significado, los hechos y la intención. Usa un tono: ${tone}. Evita frases que suenen mecanizadas, evita repeticiones y muéstralo en formato final listo para publicar.\n\nTexto original:\n"""\n${text}\n"""`;
  }

  function buildDetectPrompt(text) {
    return `Eres un detector experto de texto generado por IA. Lee el texto y evalúa la probabilidad (0-100) de que haya sido generado por una IA. Da un número entero de 0 a 100 y una explicación breve (1-2 frases) con las señales usadas para decidir. Devuélvelo en formato JSON EXACTO: {"probability": 0-100, "explanation": "..."}\n\nTexto:\n"""\n${text}\n"""`;
  }

  async function callOpenAI(payload, apiKey) {
    // This helper calls OpenAI's Chat Completions. In production you should
    // proxy this call through your server (do NOT expose API key in client JS).
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI error: ${res.status} ${text}`);
    }
    return res.json();
  }

  async function handleHumanize() {
    if (!input.trim()) return alert("Pega o escribe un texto primero.");
    let apiKey = window.__OPENAI_API_KEY__ || localStorage.getItem("openai_key");
    if (!apiKey) {
      apiKey = prompt("Introduce tu API Key de OpenAI (se guardará en sessionStorage para esta pestaña):");
      if (!apiKey) return;
      sessionStorage.setItem("openai_key", apiKey);
      setApiKeyPrompted(true);
    }

    setLoading(true);
    setOutput("");
    setScore(null);
    setReason("");

    try {
      // 1) Reescribir (humanizar)
      const prompt = buildHumanizePrompt(input);
      const payload = {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: Number(temperature),
        max_tokens: 1200,
      };

      const data = await callOpenAI(payload, apiKey);
      const humanized = data.choices?.[0]?.message?.content?.trim() || "";
      setOutput(humanized);

      // 2) Detectar si el ORIGINAL se parece a IA (score)
      const detectPayload = {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: buildDetectPrompt(input) }],
        temperature: 0,
        max_tokens: 200,
      };

      const detectResp = await callOpenAI(detectPayload, apiKey);
      const detectText = detectResp.choices?.[0]?.message?.content?.trim() || "";

      // try to parse JSON from the model (tolerant)
      let parsed = null;
      try {
        // sometimes the model returns explanatory lines before JSON; extract {...}
        const start = detectText.indexOf("{");
        const end = detectText.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
          const jsonStr = detectText.substring(start, end + 1);
          parsed = JSON.parse(jsonStr);
        }
      } catch (e) {
        // ignore parse errors
      }

      if (parsed && typeof parsed.probability !== "undefined") {
        setScore(parsed.probability);
        setReason(parsed.explanation || "");
      } else {
        // fallback: show raw response as explanation
        setScore(null);
        setReason(detectText);
      }
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!output) return alert("No hay texto para copiar.");
    navigator.clipboard.writeText(output);
    alert("Copiado al portapapeles.");
  }

  function handleSave() {
    if (!output) return alert("No hay texto para descargar.");
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "humanizado.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={styles.container}>
      <h1 style={{ textAlign: "center" }}>Humanizador avanzado + Detector de IA</h1>

      <div style={{ marginTop: 12 }}>
        <label>Modo: </label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="humanize">Humanizar y mejorar</option>
          <option value="paraphrase">Parafrasear manteniendo significado</option>
        </select>

        <label style={{ marginLeft: 12 }}>Tono: </label>
        <select value={tone} onChange={(e) => setTone(e.target.value)}>
          <option value="natural">Natural</option>
          <option value="conversacional">Conversacional</option>
          <option value="formal">Formal</option>
          <option value="juvenil">Juvenil</option>
        </select>

        <label style={{ marginLeft: 12 }}>Temperature: </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
        />
        <span style={{ marginLeft: 8 }}>{Number(temperature).toFixed(1)}</span>
      </div>

      <textarea
        style={{ ...styles.textarea, marginTop: 12 }}
        placeholder="Pega aquí el texto que quieras humanizar..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <div style={{ marginTop: 10 }}>
        <button
          style={{ ...styles.button, background: "#2563eb", color: "#fff" }}
          onClick={handleHumanize}
          disabled={loading}
        >
          {loading ? "Procesando..." : "Humanizar + Detectar IA"}
        </button>

        <button
          style={{ ...styles.button, background: "#10b981", color: "#fff" }}
          onClick={handleCopy}
        >
          Copiar resultado
        </button>

        <button
          style={{ ...styles.button, background: "#ef4444", color: "#fff" }}
          onClick={() => { setInput(""); setOutput(""); setScore(null); setReason(""); }}
        >
          Limpiar
        </button>

        <button
          style={{ ...styles.button, background: "#6b7280", color: "#fff" }}
          onClick={handleSave}
        >
          Descargar .txt
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>Resultado</h3>
        <div style={styles.output}>{output || <i>El texto humanizado aparecerá aquí.</i>}</div>
      </div>

      <div style={{ marginTop: 12 }}>
        <h3>Detector de IA</h3>
        {score !== null ? (
          <div>
            <strong>Probabilidad de texto generado por IA:</strong> {score}%
            <div style={{ marginTop: 8, background: "#f8fafc", padding: 12, borderRadius: 8 }}>
              <strong>Explicación:</strong>
              <div>{reason}</div>
            </div>
          </div>
        ) : (
          <div>
            <i>La evaluación aparecerá aquí; si el modelo no devolvió un JSON legible, verás la respuesta cruda.</i>
            <div style={{ marginTop: 8, background: "#fff7ed", padding: 12, borderRadius: 8 }}>
              {reason || <em>Sin evaluación aún.</em>}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 18, fontSize: 13, color: "#555" }}>
        <p>
          <strong>Nota de seguridad:</strong> por simplicidad esta demo solicita tu API Key en la pestaña
          y la guarda en <code>sessionStorage</code>. <strong>NO</strong> es recomendable publicar una aplicación
          que llame directamente a la API de OpenAI desde el cliente con tu clave en producción. Para un
          despliegue seguro, crea una función serverless que reciba el texto y llame a OpenAI desde el servidor.
        </p>
        <p>
          ¿Quieres que te prepare también el ejemplo listo para desplegar en Netlify / Vercel con una función serverless
          que oculte la clave y ofrezca límites de uso? Puedo generarlo ahora.
        </p>
      </div>
    </div>
  );
}
