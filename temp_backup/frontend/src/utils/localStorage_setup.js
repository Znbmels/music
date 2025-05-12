/**
 * This script sets up test authentication tokens in localStorage
 * for easier development and testing.
 * 
 * Use in browser console for quick authentication.
 */

// Sample JWT tokens for testing
const setupTestTokens = () => {
  const testTokens = {
    access: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6ImFza2FhIiwiZXhwIjoxNzgzMDY5MDExfQ.7JkTgolUwxmKFIwL-_vdU5WvD5CSfXfS2QZIR0NPeKg",
    refresh: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6ImFza2FhIiwiZXhwIjoxNzkxNzQ0ODAwfQ.rSgIUm9WpUOXNQRNb_T5h7ChxQj-oUQl7cf_I7v8b2Y"
  };

  // Save tokens to localStorage
  localStorage.setItem('vibetunes_tokens', JSON.stringify(testTokens));
  
  // Log success message
  console.log('✅ Authentication tokens have been set up!');
  console.log('User: askaa');
  console.log('You can now use the application without login.');
};

// Check if tokens already exist
const checkTokens = () => {
  const existingTokens = localStorage.getItem('vibetunes_tokens');
  
  if (!existingTokens) {
    console.log('⚠️ No authentication tokens found.');
    console.log('Run setupTestTokens() to set up test tokens.');
    return false;
  }
  
  console.log('✅ Authentication tokens already exist.');
  return true;
};

// Export for use in other modules
export { setupTestTokens, checkTokens };

// Make available in global scope for console use
window.setupTestTokens = setupTestTokens;
window.checkTokens = checkTokens;

// Automatically check tokens on script load
checkTokens(); 