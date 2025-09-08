// pages/index.js
import { useState } from 'react';
import Head from 'next/head';
import mammoth from 'mammoth';

export default function Home() {
  const [content, setContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [file, setFile] = useState(null);

  // Handle file upload
  const handleFileUpload = async (event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError(null);
    
    try {
      const text = await readFileAsText(uploadedFile);
      setContent(text);
    } catch (err) {
      setError('Error reading file content');
    }
  };

  const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const fileExtension = file.name.toLowerCase().split('.').pop();
    
    // Only allow .txt files
    if (fileExtension !== 'txt') {
      reject(new Error('Please upload only .txt files, or copy-paste your content directly into the text box below.'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      if (text.trim().length < 10) {
        reject(new Error('File appears to be empty or too short.'));
      } else {
        resolve(text.trim());
      }
    };
    reader.onerror = () => reject(new Error('Failed to read the text file.'));
    reader.readAsText(file, 'UTF-8');
  });
};

  const processDocument = async () => {
    if (!content.trim()) {
      setError('Please enter some content to analyze');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/review-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content, 
          filename: file?.name || 'manual-input.txt' 
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Processing failed');
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setError(null);
    // Show success message briefly
    const originalError = error;
    setError('✅ Copied to clipboard!');
    setTimeout(() => setError(originalError), 2000);
  };

  const downloadMarkdown = () => {
    if (!results?.sections?.correctedDocument) return;
    
    const blob = new Blob([results.sections.correctedDocument], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corrected_${file?.name || 'document'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Head>
        <title>Olixir Document Review System</title>
        <meta name="description" content="AI-powered document review for Olixir content" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        margin: 0,
        padding: 0
      }}>
        {/* Header */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          padding: '20px 0',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
        }}>
          <h1 style={{
            margin: '0 0 10px 0',
            fontSize: '2.5rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em'
          }}>
            Olixir Document Review System
          </h1>
          <p style={{
            margin: 0,
            fontSize: '1.1rem',
            color: '#6b7280',
            fontWeight: '400'
          }}>
            AI-powered content analysis for compliance and quality assurance
          </p>
        </div>

        {/* Main Content */}
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '40px 20px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '30px',
            marginBottom: '30px'
          }}>
            {/* Input Section */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '20px',
              padding: '30px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <h2 style={{
                margin: '0 0 25px 0',
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1f2937',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                📝 Document Input
              </h2>

              {/* Text Area */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '10px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Upload .txt file or paste content directly:
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste your document content here for analysis..."
                  style={{
                    width: '100%',
                    height: '300px',
                    padding: '15px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontFamily: "'Inter', monospace",
                    resize: 'vertical',
                    outline: 'none',
                    transition: 'border-color 0.3s ease',
                    background: '#fefefe'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              {/* Error Display */}
              {error && (
                <div style={{
                  backgroundColor: error.includes('✅') ? '#d1fae5' : '#fef2f2',
                  color: error.includes('✅') ? '#065f46' : '#dc2626',
                  padding: '15px',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  border: `1px solid ${error.includes('✅') ? '#a7f3d0' : '#fecaca'}`,
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  {error}
                </div>
              )}

              {/* Analyze Button */}
              <button
                onClick={processDocument}
                disabled={!content.trim() || isProcessing}
                style={{
                  width: '100%',
                  padding: '15px',
                  background: isProcessing ? 
                    'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)' : 
                    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: isProcessing ? 'none' : '0 4px 15px rgba(102, 126, 234, 0.4)',
                  transform: isProcessing ? 'scale(0.98)' : 'scale(1)'
                }}
                onMouseOver={(e) => {
                  if (!isProcessing) {
                    e.target.style.transform = 'scale(1.02)';
                    e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isProcessing) {
                    e.target.style.transform = 'scale(1)';
                    e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                  }
                }}
              >
                {isProcessing ? '🔄 Analyzing Document...' : '🚀 Analyze Document'}
              </button>
            </div>

            {/* Results Section */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '20px',
              padding: '30px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <h2 style={{
                margin: '0 0 25px 0',
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1f2937',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                📊 Analysis Results
              </h2>

              {!results ? (
                <div style={{
                  textAlign: 'center',
                  color: '#6b7280',
                  padding: '60px 20px',
                  background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                  borderRadius: '15px',
                  border: '2px dashed #d1d5db'
                }}>
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '20px',
                    opacity: '0.7'
                  }}>📄</div>
                  <p style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '500'
                  }}>
                    Upload and analyze a document to see results
                  </p>
                </div>
              ) : (
                <div>
                  {/* Risk Assessment */}
                  <div style={{
                    padding: '20px',
                    borderRadius: '15px',
                    marginBottom: '25px',
                    background: results.sections?.riskLevel === 'HIGH' ? 
                      'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' :
                      results.sections?.riskLevel === 'MEDIUM' ? 
                      'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' :
                      'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    border: `2px solid ${
                      results.sections?.riskLevel === 'HIGH' ? '#fca5a5' :
                      results.sections?.riskLevel === 'MEDIUM' ? '#fcd34d' : '#86efac'
                    }`
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '10px'
                    }}>
                      <div style={{
                        fontSize: '24px'
                      }}>
                        {results.sections?.riskLevel === 'HIGH' ? '🚨' :
                         results.sections?.riskLevel === 'MEDIUM' ? '⚠️' : '✅'}
                      </div>
                      <h3 style={{
                        margin: 0,
                        fontSize: '18px',
                        fontWeight: '600',
                        color: results.sections?.riskLevel === 'HIGH' ? '#dc2626' :
                               results.sections?.riskLevel === 'MEDIUM' ? '#d97706' : '#059669'
                      }}>
                        Risk Level: {results.sections?.riskLevel || 'MEDIUM'}
                      </h3>
                    </div>
                    <p style={{
                      margin: 0,
                      fontSize: '14px',
                      color: results.sections?.riskLevel === 'HIGH' ? '#b91c1c' :
                             results.sections?.riskLevel === 'MEDIUM' ? '#92400e' : '#047857'
                    }}>
                      {results.sections?.riskLevel === 'HIGH' && 'Immediate attention required for compliance'}
                      {results.sections?.riskLevel === 'MEDIUM' && 'Some issues found, review recommended'}
                      {results.sections?.riskLevel === 'LOW' && 'Minor or no issues found'}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    marginBottom: '25px'
                  }}>
                    <button
                      onClick={() => copyToClipboard(results.analysis)}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      📋 Copy Analysis
                    </button>
                    <button
                      onClick={downloadMarkdown}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      💾 Download .md
                    </button>
                  </div>

                  {/* Usage Info */}
                  {results.usage && (
                    <div style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid #e5e7eb',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>📈 Characters: {results.usage.charactersProcessed}</span>
                      <span>⏱️ Requests left: {results.usage.requestsRemaining}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Full Analysis Display */}
          {results && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '20px',
              padding: '30px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <h2 style={{
                margin: '0 0 25px 0',
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1f2937',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                📋 Complete Analysis Report
              </h2>
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                padding: '25px',
                borderRadius: '15px',
                border: '1px solid #e2e8f0',
                maxHeight: '500px',
                overflow: 'auto'
              }}>
                <pre style={{
                  margin: 0,
                  fontSize: '13px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  color: '#374151',
                  fontFamily: "'Inter', monospace"
                }}>
                  {results.analysis}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}