import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('BookStage renderer error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="startup-error">
          <h1>BookStage could not open this screen</h1>
          <p>{this.state.error.message}</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              window.location.hash = '#/';
              window.location.reload();
            }}
          >
            Return to Open
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
