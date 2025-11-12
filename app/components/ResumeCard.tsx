import { Link } from "react-router";
import ScoreCircle from "~/components/ScroreCircle";
import { useEffect, useState } from "react";
import { usePuterStore } from "~/lib/puter";

const ResumeCard = ({ resume: { id, jobDescription, feedback, imagePath } }: { resume: Resume }) => {
    const { fs } = usePuterStore();
    const [resumeUrl, setResumeUrl] = useState('');

    useEffect(() => {
        const loadResume = async () => {
            const blob = await fs.read(imagePath);
            if (!blob) return;
            let url = URL.createObjectURL(blob);
            setResumeUrl(url);
            // console.log({ blob, imagePath, url });
        }

        loadResume();
    }, [imagePath]);

    // Truncate job description for preview
    const truncatedDesc = jobDescription
        ? jobDescription.length > 80
            ? jobDescription.slice(0, 80) + '...'
            : jobDescription
        : 'Resume Analysis';

    return (
        <Link to={`/resume/${id}`} className="resume-card animate-in fade-in duration-1000">
            <div className="resume-card-header">
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <h2 className="text-black! font-bold wrap-break-word line-clamp-2">
                        {truncatedDesc}
                    </h2>
                </div>
                <div className="shrink-0">
                    <ScoreCircle score={feedback.overallScore} />
                </div>
            </div>
            {resumeUrl && (
                <div className="gradient-border animate-in fade-in duration-1000">
                    <div className="w-full h-full">
                        <img
                            src={resumeUrl}
                            alt="resume"
                            className="w-full h-[350px] max-sm:h-[200px] object-cover object-top"
                        />
                    </div>
                </div>
            )}
        </Link>
    )
}
export default ResumeCard