function appendElement(root, type, innerHTML) {
  const element = document.createElement(type);
  element.innerHTML = innerHTML;
  root.appendChild(element);

  return element;
} 

document.addEventListener("DOMContentLoaded", () => {
  const user = document.getElementById('user');
  const links = document.getElementById('links');

  const createLink = (href, text) => {
    links.innerHTML = '';

    const a = appendElement(links, 'a', text);
    a.setAttribute('href', href);
  };

  const setLoggedIn = (info) => {
    user.innerHTML = '';

    appendElement(user, 'h2', 'Logged in');
    const photo = appendElement(user, 'img', null);
    photo.setAttribute('src', info.photo);

    appendElement(user, 'span', `Email: ${info.email}`);
    appendElement(user, 'span', `Name: ${info.name}`);
    appendElement(user, 'span', `Expires: ${info.expires}`);

    createLink('/logout', 'Log out')
  };

  const setNotLoggedIn = () => {
    user.innerHTML = 'Not logged in';
    createLink('/login', 'Log in')
  };

  fetch('/status', { credentials: 'same-origin' })
    .then(res => res.json())
    .then(info => {
      if (info.email) {
        setLoggedIn(info);
      } else {
        setNotLoggedIn();
      }
    });
});

