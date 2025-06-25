import React, { useState } from 'react';
import AudioRecorder from './AudioRecorder';

interface NewsPieceWithRecordingProps {
  newsPiece: {
    id: string;
    text: string;
    // Add other news piece properties as needed
  };
}

const NewsPieceWithRecording: React.FC<NewsPieceWithRecordingProps> = ({ newsPiece }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{
    transcription: string;
    feedback: string;
  } | null>(null);

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('originalText', newsPiece.text);

      const response = await fetch('/api/process-audio', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process audio');
      }

      const result = await response.json();
      setFeedback(result);
    } catch (error) {
      console.error('Error processing audio:', error);
      // Handle error appropriately
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">News Piece</h2>
        <p className="text-gray-700">{newsPiece.text}</p>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Record Your Pronunciation</h3>
        <AudioRecorder
          isRecording={isRecording}
          onStartRecording={() => setIsRecording(true)}
          onStopRecording={() => setIsRecording(false)}
          onRecordingComplete={handleRecordingComplete}
        />
      </div>

      {isProcessing && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Processing your recording...</p>
        </div>
      )}

      {feedback && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Feedback</h3>
          <div className="mb-4">
            <h4 className="font-medium text-gray-700">Your Pronunciation:</h4>
            <p className="text-gray-600">{feedback.transcription}</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-700">Feedback:</h4>
            <p className="text-gray-600 whitespace-pre-line">{feedback.feedback}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsPieceWithRecording; 