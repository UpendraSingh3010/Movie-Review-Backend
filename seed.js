const mongoose = require('mongoose');
const User = require('./models/User');
const Movie = require('./models/Movie');
require('dotenv').config({ path: './config.env' });

const sampleMovies = [
  {
    title: "The Shawshank Redemption",
    genre: ["Drama"],
    releaseYear: 1994,
    director: "Frank Darabont",
    cast: ["Tim Robbins", "Morgan Freeman", "Bob Gunton"],
    synopsis: "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
    posterUrl: "https://picsum.photos/300/450?random=1",
    trailerUrl: "https://www.youtube.com/watch?v=6hB3S9bIaco",
    runtime: 142,
    language: "English",
    country: "United States",
    featured: true,
    trending: true,
    imdbRating: 9.3,
    boxOffice: 58800000
  },
  {
    title: "The Godfather",
    genre: ["Crime", "Drama"],
    releaseYear: 1972,
    director: "Francis Ford Coppola",
    cast: ["Marlon Brando", "Al Pacino", "James Caan"],
    synopsis: "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.",
    posterUrl: "https://picsum.photos/300/450?random=2",
    trailerUrl: "https://www.youtube.com/watch?v=sY1S34973zA",
    runtime: 175,
    language: "English",
    country: "United States",
    featured: true,
    trending: true,
    imdbRating: 9.2,
    boxOffice: 245066411
  },
  {
    title: "The Dark Knight",
    genre: ["Action", "Crime", "Drama"],
    releaseYear: 2008,
    director: "Christopher Nolan",
    cast: ["Christian Bale", "Heath Ledger", "Aaron Eckhart"],
    synopsis: "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.",
    posterUrl: "https://picsum.photos/300/450?random=3",
    trailerUrl: "https://www.youtube.com/watch?v=EXeTwQWrcwY",
    runtime: 152,
    language: "English",
    country: "United States",
    featured: true,
    trending: true,
    imdbRating: 9.0,
    boxOffice: 1004558444
  },
  {
    title: "Pulp Fiction",
    genre: ["Crime", "Drama"],
    releaseYear: 1994,
    director: "Quentin Tarantino",
    cast: ["John Travolta", "Uma Thurman", "Samuel L. Jackson"],
    synopsis: "The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.",
    posterUrl: "https://picsum.photos/300/450?random=4",
    trailerUrl: "https://www.youtube.com/watch?v=s7EdQ4FqbhY",
    runtime: 154,
    language: "English",
    country: "United States",
    featured: true,
    trending: false,
    imdbRating: 8.9,
    boxOffice: 213928762
  },
  {
    title: "Fight Club",
    genre: ["Drama"],
    releaseYear: 1999,
    director: "David Fincher",
    cast: ["Brad Pitt", "Edward Norton", "Helena Bonham Carter"],
    synopsis: "An insomniac office worker and a devil-may-care soapmaker form an underground fight club that evolves into something much, much more.",
    posterUrl: "https://picsum.photos/300/450?random=5",
    trailerUrl: "https://www.youtube.com/watch?v=SUXWAEX2jlg",
    runtime: 139,
    language: "English",
    country: "United States",
    featured: false,
    trending: true,
    imdbRating: 8.8,
    boxOffice: 100853753
  },
  {
    title: "Inception",
    genre: ["Action", "Adventure", "Sci-Fi"],
    releaseYear: 2010,
    director: "Christopher Nolan",
    cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Ellen Page"],
    synopsis: "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
    posterUrl: "https://picsum.photos/300/450?random=6",
    trailerUrl: "https://www.youtube.com/watch?v=YoHD9XEInc0",
    runtime: 148,
    language: "English",
    country: "United States",
    featured: true,
    trending: false,
    imdbRating: 8.8,
    boxOffice: 836836967
  },
  {
    title: "The Matrix",
    genre: ["Action", "Sci-Fi"],
    releaseYear: 1999,
    director: "Lana Wachowski",
    cast: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss"],
    synopsis: "A computer programmer discovers that reality as he knows it is a simulation created by machines, and joins a rebellion to break free.",
    posterUrl: "https://picsum.photos/300/450?random=7",
    trailerUrl: "https://www.youtube.com/watch?v=m8e-FF8MsqU",
    runtime: 136,
    language: "English",
    country: "United States",
    featured: false,
    trending: true,
    imdbRating: 8.7,
    boxOffice: 463517383
  },
  {
    title: "Goodfellas",
    genre: ["Biography", "Crime", "Drama"],
    releaseYear: 1990,
    director: "Martin Scorsese",
    cast: ["Robert De Niro", "Ray Liotta", "Joe Pesci"],
    synopsis: "The story of Henry Hill and his life in the mob, covering his relationship with his wife Karen Hill and his mob partners Jimmy Conway and Tommy DeVito.",
    posterUrl: "https://picsum.photos/300/450?random=8",
    trailerUrl: "https://www.youtube.com/watch?v=2ilzidi_J8Q",
    runtime: 146,
    language: "English",
    country: "United States",
    featured: false,
    trending: false,
    imdbRating: 8.7,
    boxOffice: 46836394
  }
];

const sampleUsers = [
  {
    username: "admin",
    email: "admin@moviereview.com",
    password: "admin123",
    isAdmin: true,
    bio: "Platform administrator and movie enthusiast."
  },
  {
    username: "movielover",
    email: "movielover@example.com",
    password: "password123",
    bio: "Passionate about cinema and discovering hidden gems."
  },
  {
    username: "critic_pro",
    email: "critic@example.com",
    password: "password123",
    bio: "Professional film critic with 10+ years of experience."
  }
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Movie.deleteMany({});
    console.log('Cleared existing data');

    // Create users
    const createdUsers = [];
    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
      console.log(`Created user: ${user.username}`);
    }

    // Create movies
    for (const movieData of sampleMovies) {
      const movie = new Movie(movieData);
      await movie.save();
      console.log(`Created movie: ${movie.title}`);
    }

    console.log('Database seeded successfully!');
    console.log(`Created ${createdUsers.length} users and ${sampleMovies.length} movies`);

    // Close connection
    await mongoose.connection.close();
    console.log('Database connection closed');

  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seed function
seedDatabase();
