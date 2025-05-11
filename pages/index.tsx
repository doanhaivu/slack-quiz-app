// pages/index.tsx
import { useState, ChangeEvent, FormEvent } from 'react';
import styles from '../styles/Home.module.css';

interface FormData {
  title: string;
  summary: string;
  url: string;
  pictureUrl: string;
  category: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct: string;
}

interface VocabularyItem {
  term: string;
  definition: string;
}

interface ResultData {
  title: string;
  summary: string;
  url: string | null;
  pictureUrl: string | null;
  category: string;
  quiz: QuizQuestion[];
  vocabulary: VocabularyItem[];
  slackMessageId: string;
}

export default function Home() {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    summary: '',
    url: '',
    pictureUrl: '',
    category: 'news',
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ResultData | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      alert('Error generating content');
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Slack Quiz Generator</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
        <label className={styles.label}>
          Title:
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className={styles.input}
          />
        </label>
        <label className={styles.label}>
          Summary:
          <textarea
            name="summary"
            value={formData.summary}
            onChange={handleChange}
            required
            className={styles.textarea}
          />
        </label>
        <label className={styles.label}>
          URL:
          <input
            type="url"
            name="url"
            value={formData.url}
            onChange={handleChange}
            className={styles.input}
          />
        </label>
        <label className={styles.label}>
          Picture URL:
          <input
            type="url"
            name="pictureUrl"
            value={formData.pictureUrl}
            onChange={handleChange}
            className={styles.input}
          />
        </label>
        <label className={styles.label}>
          Category:
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className={styles.select}
          >
            <option value="news">News</option>
            <option value="tools">Tools</option>
            <option value="prompt">Prompt</option>
          </select>
        </label>
        <button type="submit" disabled={loading} className={styles.button}>
          {loading ? 'Generating...' : 'Generate & Post to Slack'}
        </button>
      </form>
      {result && (
        <div className={styles.result}>
          <h2>Generated Content</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
