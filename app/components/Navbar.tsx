import { Link } from "react-router"

const Navbar = () => {
    return (
        <nav className="navbar">
            <Link to="/">
                <p className="text-2xl font-bold text-gradient">RESUMIND</p>
            </Link>
            <Link to="/upload">
                <p className="primary-button w-fit">upload resume</p>
            </Link>
        </nav>
    )
}

export default Navbar