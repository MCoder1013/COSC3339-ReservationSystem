import { Link } from "react-router-dom";
import "./App.css";
import { submitData } from "./api";
import { useState } from "react";

export default function Register() {
  const shipName = "Starlight Pearl Cruises";

  const [registerMessage, setRegisterMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    const target = e.target as HTMLFormElement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = target.elements as any
    const res = await submitData('/api/auth/register', {
      firstName: form.firstName.value,
      lastName: form.lastName.value,
      email: form.email.value,
      password: form.password.value,
      confirmPassword: form.confirmPassword.value,
    });
    if (res.message) {
      setRegisterMessage(res.message);
      setErrorMessage('');
    } else if (res.error) {
      setRegisterMessage('');
      setErrorMessage(res.error);
    }
  }

  return (
    <div className="page">
      <header className="navbar">
        <div className="container headerRow">
          <img src="images/StarlightPearlLogoWithName.png" 
            alt="Starlight Pearl Cruises Logo" className="logo" />
          <h1>{shipName}</h1>
          <nav className="navLinks">
            <Link className="navButton" to="/">Home</Link>
          </nav>

        </div>
      </header>

      <main className="container centeredContent">
        <section className="centerCard">
          <h2>Register</h2>

          <form className="form" onSubmit={handleSubmit}>
            <label className="label">
              First Name: 
              <input className="input" type="text" placeholder="Your First Name" required name="firstName" />
            </label>

            <br />

            <label className="label">
              Last Name: 
              <input className="input" type="text" placeholder="Your Last Name" required name="lastName" />
            </label>

            <br />

            <label className="label">
              Email: 
              <input className="input" type="email" placeholder="you@example.com" required name="email" />
            </label>

            <br />

            <label className="label">
              Password: 
              <input className="input" type="password" placeholder="••••••••" required name="password" />
            </label>

            <br />

            <label className="label">
              Confirm Password: 
              <input className="input" type="password" placeholder="••••••••" required name="confirmPassword" />
            </label>

            <br />
            <button className="primaryBtn" type="submit">Register</button>

            {registerMessage ? <p className="register-message">{registerMessage}</p> : <></>}
            {errorMessage ? <p className="error-message">{errorMessage}</p> : <></>}
          </form>
          
          <br />
          
          <p> Already have an account? </p>
          <Link className="navButton" to="/signin"> Sign In Here </Link>

        </section>
      </main>

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}