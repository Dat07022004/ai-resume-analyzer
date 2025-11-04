import { prepareInstructions, AIResponseFormat } from '../../constants';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import FileUploader from '~/components/FileUploader';
import Navbar from '~/components/Navbar'
import { convertPdfToImage } from '~/lib/pdf2img';
import { usePuterStore } from '~/lib/puter';
import { generateUUID } from '~/lib/utils';
import { sanitizeInput, detectPromptInjection, isValidFeedback } from '~/utils/security';

// AI request timeout in milliseconds (30 seconds)
const AI_REQUEST_TIMEOUT_MS = 30000;

const Upload = () => {
    const { auth, isLoading, fs, ai, kv } = usePuterStore();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const handleFileSelect = (file: File | null) => {
        setFile(file);
    }
    //

    const handleAnalyze = async ({
        companyName,
        jobTitle,
        jobDescription,
        file
    }: {
        companyName: string;
        jobTitle: string;
        jobDescription: string;
        file: File;
    }) => {
        setIsProcessing(true);
        
        try {
            // Check for Prompt Injection / Kiểm tra Prompt Injection
            if (detectPromptInjection(jobTitle) || detectPromptInjection(jobDescription)) {
                setStatusText('Error: Suspicious input detected. Please remove any instructions or system commands.');
                setIsProcessing(false);
                return;
            }
            
            // Sanitize inputs / Làm sạch inputs
            const sanitizedJobTitle = sanitizeInput(jobTitle, 200);
            const sanitizedJobDescription = sanitizeInput(jobDescription, 2000);
            const sanitizedCompanyName = sanitizeInput(companyName, 100);
            
            setStatusText('Upload the file...');
            const uploadedFile = await fs.upload([file]);
            if (!uploadedFile) throw new Error('File upload failed');

            setStatusText('Converting to image...');
            const imageFile = await convertPdfToImage(file);
            if (!imageFile.file) throw new Error('Failed to convert PDF to image');
            
            setStatusText('Upload to image...');
            const uploadedImage = await fs.upload([imageFile.file]);
            if (!uploadedImage) throw new Error('Image upload failed');

            setStatusText('Preparing data...');
            const uuid = generateUUID();
            const data = {
                id: uuid,
                resumePath: uploadedFile.path,
                imagePath: uploadedImage.path,
                companyName: sanitizedCompanyName,
                jobTitle: sanitizedJobTitle,
                jobDescription: sanitizedJobDescription,
                feedback: '',
            }
            await kv.set(`resume:${uuid}`, JSON.stringify(data));

            setStatusText('Analyzing... This may take up to 30 seconds');

            // AI feedback with timeout
            const feedbackPromise = ai.feedback(
                uploadedFile.path,
                prepareInstructions({ 
                    jobTitle: sanitizedJobTitle, 
                    jobDescription: sanitizedJobDescription, 
                    AIResponseFormat 
                })
            );
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI request timeout')), AI_REQUEST_TIMEOUT_MS)
            );
            
            const feedback = await Promise.race([feedbackPromise, timeoutPromise]) as any;

            if (!feedback) {
                setStatusText('Error: AI feedback failed');
                setIsProcessing(false);
                return;
            }

            // Safe JSON parsing
            let feedbackText: string;
            try {
                feedbackText = typeof feedback?.message?.content === 'string'
                    ? feedback.message.content
                    : feedback?.message?.content?.[0]?.text || '';
                    
                if (!feedbackText) {
                    throw new Error('Empty feedback text');
                }
            } catch (err) {
                console.error('Failed to extract feedback text:', err);
                setStatusText('Error: Invalid AI response format');
                setIsProcessing(false);
                return;
            }

            // Parse and validate JSON
            let parsedFeedback: any;
            try {
                parsedFeedback = JSON.parse(feedbackText);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                console.error('Raw response:', feedbackText);
                setStatusText('Error: Failed to parse AI response. Please try again.');
                setIsProcessing(false);
                return;
            }

            // Validate structure
            if (!isValidFeedback(parsedFeedback)) {
                console.error('Invalid feedback structure:', parsedFeedback);
                setStatusText('Error: AI returned invalid feedback format. Please try again.');
                setIsProcessing(false);
                return;
            }

            data.feedback = parsedFeedback;
            await kv.set(`resume:${uuid}`, JSON.stringify(data));
            setStatusText('Done!');
            console.log(data);
            navigate(`/resume/${uuid}`);
            
        } catch (error: any) {
            console.error('Unexpected error:', error);
            setStatusText(`Error: ${error.message || 'Something went wrong. Please try again.'}`);
        } finally {
            setIsProcessing(false);
        }
    }
    //

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget.closest('form');
        if (!form) return;
        const formData = new FormData(form);

        const companyName = formData.get('company-name') as string;
        const jobTitle = formData.get('job-title') as string;
        const jobDescription = formData.get('job-description') as string;

        if (!file) return;

        handleAnalyze({ companyName, jobTitle, jobDescription, file })

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
                            <div className='form-div'>
                                <label htmlFor="company-name">Company Name</label>
                                <input type="text" id="company-name" name="company-name" placeholder='Company Name' />
                            </div>
                            <div className='form-div'>
                                <label htmlFor="job-title">Job Title</label>
                                <input type="text" id="job-title" name="job-title" placeholder='Job Title' />
                            </div>
                            <div className='form-div'>
                                <label htmlFor="job-description">Job Description</label>
                                <textarea rows={5} id="job-description" name="job-description" placeholder='Job Description'></textarea>
                            </div>
                            <div className='form-div'>
                                <label htmlFor="uploader">Uploader</label>
                                <FileUploader onFileSelect={handleFileSelect} />
                            </div>
                            <button className='primary-button' type='submit'>
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