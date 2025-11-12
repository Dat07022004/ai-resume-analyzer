import { prepareInstructions, AIResponseFormat } from '../../constants';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import FileUploader from '~/components/FileUploader';
import Navbar from '~/components/Navbar'
import { convertPdfToImage } from '~/lib/pdf2img';
import { usePuterStore } from '~/lib/puter';
import { generateUUID } from '~/lib/utils';
import { detectPromptInjection, getInjectionWarningMessage } from '~/lib/promptInjectionDetector';

const Upload = () => {
    const { auth, isLoading, fs, ai, kv } = usePuterStore();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [securityWarning, setSecurityWarning] = useState('');
    const [jobDescValue, setJobDescValue] = useState('');

    const handleFileSelect = (file: File | null) => {
        setFile(file);
    }

    // Real-time detection as user types
    const handleJobDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setJobDescValue(value);

        if (value.length > 20) { // Only check if significant input
            const check = detectPromptInjection(value);
            if (check.isSuspicious) {
                setSecurityWarning(getInjectionWarningMessage(check));
            } else {
                setSecurityWarning('');
            }
        } else {
            setSecurityWarning('');
        }
    }
    //

    const handleAnalyze = async ({
        jobDescription,
        file
    }: {
        jobDescription: string;
        file: File;
    }) => {
        // 🛡️ SECURITY: Detect prompt injection attempts
        const injectionCheck = detectPromptInjection(jobDescription);

        if (injectionCheck.isSuspicious) {
            const warningMsg = getInjectionWarningMessage(injectionCheck);
            setSecurityWarning(warningMsg);
            console.warn('⚠️ Prompt Injection Detected:', {
                confidence: injectionCheck.confidence,
                patterns: injectionCheck.detectedPatterns,
                originalInput: jobDescription
            });

            // Log for security monitoring (async, don't wait)
            kv.set(`security:injection:${Date.now()}`, JSON.stringify({
                timestamp: new Date().toISOString(),
                confidence: injectionCheck.confidence,
                patterns: injectionCheck.detectedPatterns,
                input: jobDescription.slice(0, 200) // Store first 200 chars only
            })).catch(err => console.error('Failed to log security incident:', err));

            // Show alert for high-confidence attacks
            if (injectionCheck.confidence >= 0.5) {
                alert(`🚨 Security Warning!\n\nSuspicious input detected (${Math.round(injectionCheck.confidence * 100)}% confidence).\n\nDetected patterns:\n${injectionCheck.detectedPatterns.slice(0, 3).join('\n')}\n\nThe analysis will continue with sanitized input.`);
            }
        }

        setIsProcessing(true);
        setStatusText('Upload the file...');
        const uploadedFile = await fs.upload([file]);

        if (!uploadedFile) return setStatusText('Error: File upload failed');

        setStatusText('Converting to image...');
        const imageFile = await convertPdfToImage(file);
        if (!imageFile.file) return setStatusText('Error: Failed to convert PDF to image');
        setStatusText('Upload to image...');

        const uploadedImage = await fs.upload([imageFile.file]);
        if (!uploadedImage) return setStatusText('Error: Image upload failed');

        setStatusText('Preparing data...');

        const uuid = generateUUID();
        const data = {
            id: uuid,
            resumePath: uploadedFile.path,
            imagePath: uploadedImage.path,
            jobDescription,
            feedback: '',
        }
        await kv.set(`resume:${uuid}`, JSON.stringify(data));

        setStatusText('Analyzing...');

        //AI feeback
        try {
            const feedback = await ai.feedback(
                uploadedFile.path,
                prepareInstructions({ jobDescription, AIResponseFormat })
            )

            if (!feedback) {
                setIsProcessing(false);
                return setStatusText('Error: AI feedback failed');
            }

            const feedbackText = typeof feedback.message.content === 'string'
                ? feedback.message.content
                : feedback.message.content[0].text;

            data.feedback = JSON.parse(feedbackText);
            await kv.set(`resume:${uuid}`, JSON.stringify(data));
            setStatusText('Done!');
            console.log(data);
            navigate(`/resume/${uuid}`);
        } catch (error: any) {
            console.error('AI Analysis Error:', error);
            setIsProcessing(false);

            // Handle specific Puter API errors
            if (error?.code === 'error_400_from_delegate') {
                setStatusText('⚠️ AI service quota exceeded. Please try again later or upgrade your Puter account.');
            } else {
                setStatusText(`Error: ${error?.message || 'AI analysis failed'}`);
            }
        }

    }
    //

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSecurityWarning(''); // Clear previous warnings

        const form = e.currentTarget.closest('form');
        if (!form) return;
        const formData = new FormData(form);

        const jobDescription = formData.get('job-description') as string;

        if (!file || !jobDescription.trim()) return;

        handleAnalyze({ jobDescription, file })

    }

    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover">
            <Navbar />
            <section className="main-section">
                <div className='main-section'>
                    <h1>Smart feedback for your resume</h1>
                    {isProcessing ? (
                        <>
                            <h2>{statusText}</h2>
                            <img src="/images/resume-scan.gif" className='w-full' />
                        </>
                    ) : (
                        <h2>Drop your resume here</h2>
                    )}
                    {!isProcessing && (
                        <form id='upload-form' onSubmit={handleSubmit} className='flex flex-col gap-4 mt-8'>
                            {securityWarning && (
                                <div className='bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded' role="alert">
                                    <p className='font-bold'>Security Alert</p>
                                    <p className='text-sm'>{securityWarning}</p>
                                    <p className='text-xs mt-2'>
                                        Your input has been logged for security monitoring.
                                        The analysis will continue with sanitized input.
                                    </p>
                                </div>
                            )}
                            <div className='form-div'>
                                <label htmlFor="job-description">Job Description</label>
                                <textarea
                                    rows={6}
                                    id="job-description"
                                    name="job-description"
                                    placeholder='Paste the job description here...'
                                    required
                                    maxLength={2000}
                                    value={jobDescValue}
                                    onChange={handleJobDescChange}
                                ></textarea>
                                <small className='text-gray-500 text-sm mt-1'>
                                    {jobDescValue.length}/2000 characters
                                    {securityWarning && (
                                        <span className='text-red-600 ml-2'>⚠️ Suspicious pattern detected</span>
                                    )}
                                </small>
                            </div>
                            <div className='form-div'>
                                <label htmlFor="uploader">Upload Resume (PDF)</label>
                                <FileUploader onFileSelect={handleFileSelect} />
                            </div>
                            <button className='primary-button' type='submit' disabled={!file}>
                                Analyze Resume
                            </button>
                        </form>
                    )}
                </div>
            </section>
        </main>
    )
}

export default Upload;