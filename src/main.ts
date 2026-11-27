const app = document.querySelector('#app');
if (app) {
  const heading = document.createElement('h1');
  heading.textContent = 'Habit grid';
  app.replaceChildren(heading);
}
